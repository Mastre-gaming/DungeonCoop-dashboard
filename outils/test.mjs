#!/usr/bin/env node
// Le test sans écran. Il ouvre la page dans Chrome ou Edge sans fenêtre, attend les vérifications de
// src/test.js, prend des captures dans captures/ et sort en erreur si quelque chose rate.
//
//   node outils/test.mjs                    les vérifications ?test (données de démo), bureau clair et sombre, téléphone
//   node outils/test.mjs --vrai             en plus, une capture avec les vraies données de GitHub (coûte ~15 appels sur 60)
//   node outils/test.mjs --direct <url> --secret <s>
//                                           avec un Worker lancé (npm run dev dans worker/) : envoie un faux webhook
//                                           signé et vérifie que la page ouverte le montre tout de suite
//
// Aucune dépendance : Node 22 ou plus. CHROME=chemin/vers/le/navigateur pour en choisir un.

import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrer } from './serveur.mjs';

// CAPTURES=… pour les mettre ailleurs : utile avec « wrangler dev », qui redémarre à chaque fichier écrit dans le repo.
const CAPTURES = process.env.CAPTURES ?? fileURLToPath(new URL('../captures/', import.meta.url));
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const arguments_ = process.argv.slice(2);
const option = (nom) => {
  const i = arguments_.indexOf(nom);
  return i < 0 ? null : arguments_[i + 1] ?? true;
};

const NAVIGATEURS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

async function lancerNavigateur() {
  const exe = NAVIGATEURS.find((chemin) => existsSync(chemin));
  if (!exe) throw new Error('Ni Chrome ni Edge trouvé. Indique le chemin : CHROME=… node outils/test.mjs');
  const profil = await mkdtemp(join(tmpdir(), 'dashboard-test-'));
  const options = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profil}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--enable-unsafe-swiftshader', '--disable-extensions', '--hide-scrollbars'];
  if (process.env.CI) options.push('--no-sandbox'); // les machines de GitHub Actions
  const navigateur = spawn(exe, [...options, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const adresse = await new Promise((ok, ko) => {
    let lu = '';
    const delai = setTimeout(() => ko(new Error('Le navigateur ne démarre pas.')), 20_000);
    navigateur.stderr.on('data', (morceau) => {
      lu += morceau;
      const m = lu.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(delai);
        ok(m[1]);
      }
    });
    navigateur.on('exit', (code) => ko(new Error(`Le navigateur s’est arrêté (code ${code}).`)));
  });
  return { navigateur, adresse, profil };
}

// Un client minimal du protocole DevTools (ce que Puppeteer fait, en 30 lignes).
function devtools(adresse) {
  const socket = new WebSocket(adresse);
  let numero = 0;
  const attente = new Map();
  const ecouteurs = [];
  socket.addEventListener('message', (evenement) => {
    const message = JSON.parse(evenement.data);
    if (message.id && attente.has(message.id)) {
      const { ok, ko } = attente.get(message.id);
      attente.delete(message.id);
      if (message.error) ko(new Error(message.error.message));
      else ok(message.result);
    } else {
      for (const ecouteur of ecouteurs) ecouteur(message);
    }
  });
  return {
    pret: new Promise((ok, ko) => {
      socket.addEventListener('open', ok);
      socket.addEventListener('error', () => ko(new Error('DevTools injoignable')));
    }),
    envoyer(method, params = {}, sessionId) {
      const id = ++numero;
      socket.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((ok, ko) => attente.set(id, { ok, ko }));
    },
    ecouter: (ecouteur) => ecouteurs.push(ecouteur),
    fermer: () => socket.close(),
  };
}

async function ouvrirOnglet(dt) {
  const { targetId } = await dt.envoyer('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await dt.envoyer('Target.attachToTarget', { targetId, flatten: true });
  const envoyer = (method, params) => dt.envoyer(method, params, sessionId);
  const erreurs = [];
  dt.ecouter((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') erreurs.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erreurs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') erreurs.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`.trim());
  });
  await envoyer('Page.enable');
  await envoyer('Runtime.enable');
  await envoyer('Log.enable');

  const evaluer = async (expression) => (await envoyer('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

  return {
    erreurs,
    evaluer,
    async aller(url, { largeur = 1440, hauteur = 1000, sombre = false } = {}) {
      await envoyer('Emulation.setDeviceMetricsOverride', { width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: largeur < 700 });
      await envoyer('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: sombre ? 'dark' : 'light' }] });
      await envoyer('Page.navigate', { url });
    },
    async attendre(expression, ms = 20_000) {
      const debut = Date.now();
      while (Date.now() - debut < ms) {
        const valeur = await evaluer(expression).catch(() => null);
        if (valeur) return valeur;
        await pause(100);
      }
      throw new Error(`Rien après ${ms / 1000} s : ${expression}`);
    },
    async capturer(nom) {
      const metriques = await envoyer('Page.getLayoutMetrics');
      const { width, height } = metriques.cssContentSize ?? metriques.contentSize;
      const { data } = await envoyer('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
      await mkdir(CAPTURES, { recursive: true });
      await writeFile(join(CAPTURES, `${nom}.png`), Buffer.from(data, 'base64'));
      return join(CAPTURES, `${nom}.png`);
    },
  };
}

async function principal() {
  const serveur = await demarrer(0);
  const page = `http://127.0.0.1:${serveur.address().port}`;
  const { navigateur, adresse, profil } = await lancerNavigateur();
  const dt = devtools(adresse);
  await dt.pret;
  const onglet = await ouvrirOnglet(dt);
  const echecs = [];

  try {
    // 1. Les vérifications, sur bureau en clair, puis en sombre et sur téléphone pour les captures.
    for (const [nom, vue] of [['bureau', {}], ['bureau-sombre', { sombre: true }], ['telephone', { largeur: 390, hauteur: 844 }]]) {
      await onglet.aller(`${page}/?test&moi=demo-brams`, vue);
      const score = await onglet.attendre('document.documentElement.dataset.test');
      const resultats = await onglet.evaluer('window.__resultats');
      const debordement = await onglet.evaluer('document.documentElement.scrollWidth - window.innerWidth');
      if (nom === 'bureau') for (const r of resultats) console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.nom}${r.ok ? '' : `  →  ${r.detail}`}`);
      const rates = resultats.filter((r) => !r.ok).map((r) => `${nom} : ${r.nom}`);
      echecs.push(...rates);
      if (debordement > 0) echecs.push(`${nom} : la page déborde de ${debordement} px en largeur`);
      console.log(`${nom} : ${score} vérifications · capture ${await onglet.capturer(nom)}`);
    }

    // Le thème choisi s'applique dès l'ouverture, même si l'ordinateur est en clair.
    await onglet.evaluer("localStorage.setItem('dungeoncoop:theme', 'dark')");
    await onglet.aller(`${page}/?demo`);
    await onglet.attendre('document.querySelectorAll(".carte[data-etat]").length === 6');
    const sombre = await onglet.evaluer("document.documentElement.dataset.theme === 'dark' && getComputedStyle(document.body).backgroundColor === 'rgb(13, 13, 13)'");
    if (!sombre) echecs.push('thème : le choix « Sombre » gardé ne s’applique pas à l’ouverture');
    console.log(`thème gardé : ${sombre ? 'ok' : 'raté'} · capture ${await onglet.capturer('theme-sombre-choisi')}`);
    await onglet.evaluer("localStorage.removeItem('dungeoncoop:theme')");

    // 2. Les vraies données, sans vérification de contenu : aucun widget ne doit planter.
    if (option('--vrai')) {
      await onglet.aller(`${page}/?sans-direct`);
      await onglet.attendre('document.querySelectorAll(".carte[data-etat]").length === 6');
      const enErreur = await onglet.evaluer('[...document.querySelectorAll(".carte[data-etat=erreur]")].map(c => c.id + " : " + c.textContent.trim())');
      echecs.push(...enErreur.map((e) => `vrai : ${e}`));
      console.log(`vrai : ${6 - enErreur.length}/6 widgets chargés · capture ${await onglet.capturer('vrai')}`);
    }

    // 3. Le direct, avec un Worker lancé : un faux webhook signé doit s'afficher tout de suite.
    const direct = option('--direct');
    if (direct) {
      const secret = option('--secret');
      if (!secret) throw new Error('--direct demande aussi --secret (le WEBHOOK_SECRET de worker/.dev.vars)');
      await onglet.aller(`${page}/?direct=${encodeURIComponent(direct)}`);
      await onglet.attendre('document.querySelector("#etat.direct")', 15_000);
      await onglet.attendre('document.querySelectorAll(".carte[data-etat]").length === 6');
      const corps = JSON.stringify({ zen: 'Test du dashboard', hook_id: 1, repository: { name: 'DungeonCoop', full_name: 'Mastre-gaming/DungeonCoop', html_url: 'https://github.com/Mastre-gaming/DungeonCoop' }, sender: { login: 'test' } });
      const signature = `sha256=${createHmac('sha256', secret).update(corps).digest('hex')}`;
      const envoye = Date.now();
      const reponse = await fetch(`${direct}/webhook`, { method: 'POST', body: corps, headers: { 'Content-Type': 'application/json', 'X-GitHub-Event': 'ping', 'X-Hub-Signature-256': signature } });
      if (!reponse.ok) echecs.push(`direct : le Worker a répondu ${reponse.status} au webhook`);
      await onglet.attendre('document.querySelector("#notifs")?.textContent.includes("Webhook branché")', 5000)
        .then(() => console.log(`direct : notification reçue en ${Date.now() - envoye} ms`))
        .catch(() => echecs.push('direct : la notification n’est pas arrivée en 5 s'));
      const faux = await fetch(`${direct}/webhook`, { method: 'POST', body: corps, headers: { 'X-GitHub-Event': 'ping', 'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}` } });
      if (faux.status !== 401) echecs.push(`direct : un webhook mal signé reçoit ${faux.status} au lieu de 401`);
      console.log(`direct : capture ${await onglet.capturer('direct')}`);
    }

    // 4. La porte, avec la page servie par wrangler (npx wrangler dev à la racine, MOT_DE_PASSE dans .dev.vars).
    const porte = option('--porte');
    if (porte) {
      const motDePasse = option('--mot-de-passe');
      if (!motDePasse) throw new Error('--porte demande aussi --mot-de-passe (le MOT_DE_PASSE de .dev.vars)');
      const nombreErreurs = onglet.erreurs.length;
      await onglet.aller(`${porte}/?sans-direct`);
      await onglet.attendre('document.querySelector("input[type=password]")');
      console.log(`porte : écran d’entrée · capture ${await onglet.capturer('entree')}`);
      const remplir = (mdp) => onglet.evaluer(`(() => {
        document.querySelector('input[name=mot_de_passe]').value = ${JSON.stringify(mdp)};
        document.querySelector('input[name=nom]').value = 'Paul';
        document.querySelector('form').submit();
        return true;
      })()`);
      await remplir('pas-le-bon');
      await onglet.attendre('document.querySelector(".message")?.textContent.includes("incorrect")')
        .catch(() => echecs.push('porte : un mauvais mot de passe n’affiche pas d’erreur'));
      await remplir(motDePasse);
      await onglet.attendre('document.querySelectorAll(".carte[data-etat]").length === 6')
        .catch(() => echecs.push('porte : le dashboard ne s’ouvre pas après le bon mot de passe'));
      const apres = await onglet.evaluer(`({
        nom: document.querySelector('#nom-session')?.textContent,
        sessionVisible: !document.querySelector('#session')?.hidden,
        choixCache: document.querySelector('#choix-moi')?.hidden,
        pourToi: document.querySelector('#pour-toi h2')?.textContent ?? '',
        adresse: location.search,
      })`);
      if (apres.nom !== 'Paul' || !apres.sessionVisible || !apres.choixCache) echecs.push(`porte : le nom n’est pas affiché (${JSON.stringify(apres)})`);
      if (!apres.pourToi.includes('Paul')) echecs.push(`porte : « Pour toi » ne reconnaît pas Paul (${apres.pourToi})`);
      if (apres.adresse !== '?sans-direct') echecs.push(`porte : l’entrée ne ramène pas à l’adresse demandée (${apres.adresse})`);
      console.log(`porte : entré comme ${apres.nom} · capture ${await onglet.capturer('apres-entree')}`);
      // Sprite Painter, servi par la porte depuis le demo.html de BABA.
      await onglet.aller(`${porte}/sprite-painter/`);
      await onglet.attendre('document.querySelector("#import") && document.querySelector("canvas") && !document.body.innerText.includes("Loading")', 30_000)
        .then(async () => console.log(`porte : Sprite Painter ouvert · capture ${await onglet.capturer('sprite-painter')}`))
        .catch(() => echecs.push('porte : Sprite Painter ne s’ouvre pas sur /sprite-painter/'));
      await onglet.aller(`${porte}/deconnexion`);
      await onglet.attendre('document.querySelector("input[type=password]")')
        .then(() => console.log('porte : déconnexion ok'))
        .catch(() => echecs.push('porte : la déconnexion ne ramène pas à l’écran d’entrée'));
      // Les 401 de la page d'entrée sont voulus : on ne les compte pas comme des erreurs de la page.
      onglet.erreurs.splice(nombreErreurs, onglet.erreurs.length - nombreErreurs,
        ...onglet.erreurs.slice(nombreErreurs).filter((e) => !/401|Unauthorized/.test(e)));
    }

    if (onglet.erreurs.length) echecs.push(...onglet.erreurs.map((e) => `erreur dans la page : ${e}`));
  } finally {
    dt.fermer();
    navigateur.kill();
    serveur.close();
    await pause(300);
    await rm(profil, { recursive: true, force: true }).catch(() => {});
  }

  if (echecs.length) {
    console.error(`\n${echecs.length} problème(s) :\n${echecs.map((e) => `  ✗ ${e}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\nTout est vert.');
}

principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
