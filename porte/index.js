// La porte du dashboard : ce Worker passe devant tous les fichiers de la page (run_worker_first).
// Sans laissez-passer valide, il montre l'écran d'entrée (mot de passe + nom du dev) ; avec, il sert la page.
//
//   POST /connexion     vérifie le mot de passe (secret MOT_DE_PASSE), pose le cookie pour 30 jours
//   GET  /deconnexion   retire le cookie
//   GET  /session       { nom, jeton } pour la page : son nom, et le jeton que vérifie le Worker direct
//
// Le mot de passe n'est jamais dans le repo : c'est un secret Cloudflare.

import { creerJeton, DUREE_SESSION, lireJeton, motDePasseValide, nomValide } from '../worker/src/session.js';
import { pageEntree } from './page.js';

const COOKIE = 'dc_session';
const ESSAIS_MAX = 8; // mauvais mots de passe par adresse IP…
const ESSAIS_FENETRE = 10 * 60_000; // …en 10 minutes
const echecs = new Map(); // propre à chaque instance du Worker : un frein, pas un mur

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);

    if (!env.MOT_DE_PASSE) {
      return html(pageEntree({ panne: 'Le mot de passe n’est pas encore réglé dans Cloudflare (secret MOT_DE_PASSE).' }), 503);
    }
    if (url.pathname === '/connexion' && requete.method === 'POST') return connexion(requete, env);
    if (url.pathname === '/deconnexion') return redirection('/', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);

    const jeton = lireCookie(requete, COOKIE);
    const session = jeton ? await lireJeton(env.MOT_DE_PASSE, jeton) : null;

    if (url.pathname === '/session') {
      return Response.json(session ? { nom: session.nom, jeton } : { erreur: 'pas connecté' }, {
        status: session ? 200 : 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (session) return env.ASSETS.fetch(requete);

    // Pas connecté : l'écran d'entrée pour une page, un simple refus pour le reste (scripts, JSON…).
    if (requete.method === 'GET' && (requete.headers.get('Accept') ?? '').includes('text/html')) {
      return html(pageEntree({ noms: await nomsEquipe(requete, env), suite: url.pathname + url.search }), 401);
    }
    return new Response('Connexion requise.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};

async function connexion(requete, env) {
  const ip = requete.headers.get('CF-Connecting-IP') ?? 'inconnue';
  const formulaire = await requete.formData().catch(() => new FormData());
  const nom = String(formulaire.get('nom') ?? '').trim().replace(/\s+/g, ' ');
  const suite = suiteSure(String(formulaire.get('suite') ?? '/'));
  const noms = await nomsEquipe(requete, env);

  if (tropDEssais(ip)) {
    return html(pageEntree({ noms, nom, suite, erreur: 'Trop d’essais ratés. Attends dix minutes avant de réessayer.' }), 429);
  }
  if (!motDePasseValide(env.MOT_DE_PASSE, String(formulaire.get('mot_de_passe') ?? ''))) {
    noterEchec(ip);
    await new Promise((ok) => setTimeout(ok, 400)); // ralentit ceux qui essaient au hasard
    return html(pageEntree({ noms, nom, suite, erreur: 'Mot de passe incorrect.' }), 401);
  }
  if (!nomValide(nom)) {
    return html(pageEntree({ noms, nom, suite, erreur: 'Écris ton nom de dev : 1 à 40 lettres, chiffres, espaces ou tirets.' }), 400);
  }
  const jeton = await creerJeton(env.MOT_DE_PASSE, nom);
  return redirection(suite, `${COOKIE}=${jeton}; Path=/; Max-Age=${DUREE_SESSION / 1000}; HttpOnly; Secure; SameSite=Lax`);
}

// Seulement une adresse de ce site (« /… »), jamais « //ailleurs.com » ni la page de connexion elle-même.
function suiteSure(suite) {
  return /^\/(?!\/)/.test(suite) && !suite.startsWith('/connexion') && !suite.startsWith('/deconnexion') ? suite : '/';
}

function tropDEssais(ip) {
  const maintenant = Date.now();
  const recents = (echecs.get(ip) ?? []).filter((t) => maintenant - t < ESSAIS_FENETRE);
  echecs.set(ip, recents);
  return recents.length >= ESSAIS_MAX;
}

function noterEchec(ip) {
  echecs.set(ip, [...(echecs.get(ip) ?? []), Date.now()]);
}

// Les noms proposés à l'entrée viennent d'equipe.json (le nom affiché, sinon le pseudo GitHub).
async function nomsEquipe(requete, env) {
  try {
    const reponse = await env.ASSETS.fetch(new Request(new URL('/equipe.json', requete.url)));
    if (!reponse.ok) return [];
    return (await reponse.json()).map((m) => m.nom || m.github).filter(Boolean);
  } catch {
    return [];
  }
}

function lireCookie(requete, nom) {
  for (const morceau of (requete.headers.get('Cookie') ?? '').split(';')) {
    const [cle, ...valeur] = morceau.trim().split('=');
    if (cle === nom) return valeur.join('=');
  }
  return null;
}

function html(corps, status) {
  return new Response(corps, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' },
  });
}

function redirection(vers, cookie) {
  return new Response(null, { status: 303, headers: { Location: vers, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
}
