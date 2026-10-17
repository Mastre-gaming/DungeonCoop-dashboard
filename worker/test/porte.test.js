// La porte de la page (porte/index.js), testée sans Cloudflare : un faux ASSETS joue les fichiers de la page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import porte from '../../porte/index.js';
import { lireJeton } from '../src/session.js';

const SECRET = 'mot-de-passe-de-test';
const SITE = 'https://dungeoncoop-dashboard.exemple.dev';

function environnement(secret = SECRET) {
  const servis = [];
  return {
    servis,
    env: {
      MOT_DE_PASSE: secret,
      ASSETS: {
        async fetch(requete) {
          const chemin = new URL(requete.url).pathname;
          servis.push(chemin);
          if (chemin === '/equipe.json') return Response.json([{ github: 'PCrrfng', nom: 'Paul' }, { github: 'DonBabaa', nom: '' }]);
          return new Response(`fichier ${chemin}`);
        },
      },
    },
  };
}

const page = (chemin, entetes = {}) => new Request(`${SITE}${chemin}`, { headers: { Accept: 'text/html', ...entetes } });
const entrer = (champs, ip = '1.2.3.4') => new Request(`${SITE}/connexion`, {
  method: 'POST',
  body: new URLSearchParams(champs),
  headers: { 'CF-Connecting-IP': ip },
});
const cookieDe = (reponse) => reponse.headers.get('Set-Cookie').split(';')[0];

test('sans laissez-passer : l’écran d’entrée, avec les noms de l’équipe ; aucun fichier de la page', async () => {
  const { env, servis } = environnement();
  const reponse = await porte.fetch(page('/'), env);
  const html = await reponse.text();
  assert.equal(reponse.status, 401);
  assert.match(html, /type="password"/);
  assert.match(html, /<option value="Paul">/);
  assert.match(html, /<option value="DonBabaa">/);
  assert.deepEqual(servis, ['/equipe.json']);
  const script = await porte.fetch(new Request(`${SITE}/src/main.js`), env);
  assert.equal(script.status, 401);
  assert.equal((await porte.fetch(new Request(`${SITE}/session`), env)).status, 401);
  assert.deepEqual(servis, ['/equipe.json']);
});

test('le bon mot de passe ouvre la porte pour 30 jours, et ramène où on allait', async () => {
  const { env, servis } = environnement();
  const reponse = await porte.fetch(entrer({ mot_de_passe: SECRET, nom: '  Paul ', suite: '/?demo' }), env);
  assert.equal(reponse.status, 303);
  assert.equal(reponse.headers.get('Location'), '/?demo');
  const cookie = reponse.headers.get('Set-Cookie');
  for (const morceau of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) assert.ok(cookie.includes(morceau), morceau);

  const ouverte = await porte.fetch(page('/', { Cookie: cookieDe(reponse) }), env);
  assert.equal(await ouverte.text(), 'fichier /');
  assert.ok(servis.includes('/'));

  const session = await (await porte.fetch(new Request(`${SITE}/session`, { headers: { Cookie: `autre=1; ${cookieDe(reponse)}` } }), env)).json();
  assert.equal(session.nom, 'Paul');
  assert.equal((await lireJeton(SECRET, session.jeton)).nom, 'Paul', 'le Worker direct pourra vérifier ce jeton');
});

test('un mauvais mot de passe : refusé, le nom tapé est gardé (et échappé)', async () => {
  const { env } = environnement();
  const reponse = await porte.fetch(entrer({ mot_de_passe: 'faux', nom: 'Paul<b>' }, '5.5.5.5'), env);
  const html = await reponse.text();
  assert.equal(reponse.status, 401);
  assert.match(html, /Mot de passe incorrect/);
  assert.match(html, /value="Paul&lt;b&gt;"/);
  assert.equal(reponse.headers.get('Set-Cookie'), null);
});

test('un nom vide ou bizarre est refusé, même avec le bon mot de passe', async () => {
  const { env } = environnement();
  for (const nom of ['', '<script>', 'x'.repeat(50)]) {
    const reponse = await porte.fetch(entrer({ mot_de_passe: SECRET, nom }), env);
    assert.equal(reponse.status, 400, nom);
    assert.equal(reponse.headers.get('Set-Cookie'), null);
  }
});

test('après trop d’essais ratés, la porte attend', async () => {
  const { env } = environnement();
  for (let i = 0; i < 8; i++) await porte.fetch(entrer({ mot_de_passe: `essai${i}`, nom: 'X' }, '9.9.9.9'), env);
  const reponse = await porte.fetch(entrer({ mot_de_passe: SECRET, nom: 'Paul' }, '9.9.9.9'), env);
  assert.equal(reponse.status, 429);
  assert.equal((await porte.fetch(entrer({ mot_de_passe: SECRET, nom: 'Paul' }, '8.8.8.8'), env)).status, 303, 'les autres ne sont pas bloqués');
});

test('on ne repart jamais vers un autre site après l’entrée', async () => {
  const { env } = environnement();
  for (const suite of ['//pirate.example', 'https://pirate.example', '/connexion', 'rien']) {
    const reponse = await porte.fetch(entrer({ mot_de_passe: SECRET, nom: 'Paul', suite }, '7.7.7.7'), env);
    assert.equal(reponse.headers.get('Location'), '/', suite);
  }
});

test('un cookie trafiqué ou d’avant un changement de mot de passe ne passe pas', async () => {
  const ancien = environnement('ancien-mot-de-passe');
  const cookie = cookieDe(await porte.fetch(entrer({ mot_de_passe: 'ancien-mot-de-passe', nom: 'Paul' }, '6.6.6.6'), ancien.env));
  const { env, servis } = environnement();
  assert.equal((await porte.fetch(page('/', { Cookie: cookie }), env)).status, 401);
  assert.equal((await porte.fetch(page('/', { Cookie: `${cookie}x` }), env)).status, 401);
  assert.ok(!servis.includes('/'));
});

test('se déconnecter retire le cookie', async () => {
  const { env } = environnement();
  const reponse = await porte.fetch(new Request(`${SITE}/deconnexion`), env);
  assert.equal(reponse.status, 303);
  assert.match(reponse.headers.get('Set-Cookie'), /^dc_session=; .*Max-Age=0/);
});

test('sans secret MOT_DE_PASSE, la porte reste fermée et le dit', async () => {
  const { env, servis } = environnement('');
  const reponse = await porte.fetch(page('/'), env);
  assert.equal(reponse.status, 503);
  assert.match(await reponse.text(), /MOT_DE_PASSE/);
  assert.equal((await porte.fetch(entrer({ mot_de_passe: '', nom: 'Paul' }), env)).status, 503);
  assert.deepEqual(servis, []);
});

// Sprite Painter : la porte relit le demo.html de BABA sur GitHub et le sert comme une page.
const SOURCES = 'https://raw.exemple/branche/demo.html,https://raw.exemple/main/demo.html';

async function avecFauxGithub(reponses, essai) {
  const vrai = globalThis.fetch;
  const demandes = [];
  globalThis.fetch = async (url) => {
    demandes.push(String(url));
    const r = reponses[String(url)];
    return r ? new Response(r.corps, { status: r.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }) : new Response('', { status: 404 });
  };
  try {
    return await essai(demandes);
  } finally {
    globalThis.fetch = vrai;
  }
}

async function cookieValide(env) {
  return cookieDe(await porte.fetch(entrer({ mot_de_passe: SECRET, nom: 'Paul' }, '4.4.4.4'), env));
}

test('Sprite Painter : servi comme une page, depuis la branche de BABA', async () => {
  const { env } = environnement();
  env.SPRITE_PAINTER = SOURCES;
  const cookie = await cookieValide(env);
  await avecFauxGithub({ 'https://raw.exemple/branche/demo.html': { status: 200, corps: '<!doctype html><title>Sprite Painter</title>' } }, async (demandes) => {
    for (const chemin of ['/sprite-painter/', '/sprite-painter']) {
      const reponse = await porte.fetch(page(chemin, { Cookie: cookie }), env);
      assert.equal(reponse.status, 200);
      assert.equal(reponse.headers.get('Content-Type'), 'text/html; charset=utf-8');
      assert.match(await reponse.text(), /Sprite Painter/);
    }
    assert.deepEqual(demandes, ['https://raw.exemple/branche/demo.html', 'https://raw.exemple/branche/demo.html']);
  });
});

test('Sprite Painter : la branche fusionnée, on le trouve sur main ; nulle part, on le dit', async () => {
  const { env } = environnement();
  env.SPRITE_PAINTER = SOURCES;
  const cookie = await cookieValide(env);
  await avecFauxGithub({ 'https://raw.exemple/main/demo.html': { status: 200, corps: 'depuis main' } }, async (demandes) => {
    assert.equal(await (await porte.fetch(page('/sprite-painter/', { Cookie: cookie }), env)).text(), 'depuis main');
    assert.equal(demandes.length, 2);
  });
  await avecFauxGithub({}, async () => {
    const reponse = await porte.fetch(page('/sprite-painter/', { Cookie: cookie }), env);
    assert.equal(reponse.status, 502);
    assert.match(await reponse.text(), /SPRITE_PAINTER/);
  });
});

test('Sprite Painter : derrière le mot de passe, comme le reste', async () => {
  const { env } = environnement();
  env.SPRITE_PAINTER = SOURCES;
  await avecFauxGithub({ 'https://raw.exemple/branche/demo.html': { status: 200, corps: 'secret' } }, async (demandes) => {
    const reponse = await porte.fetch(page('/sprite-painter/'), env);
    assert.equal(reponse.status, 401);
    assert.match(await reponse.text(), /name="suite" value="\/sprite-painter\/"/);
    assert.deepEqual(demandes, []);
  });
});
