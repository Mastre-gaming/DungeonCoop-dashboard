// Tous les appels de données passent ici. Les widgets demandent un chemin de l'API GitHub
// (« /repos/…/pulls?state=open ») et ce fichier choisit d'où vient la réponse :
//   - démo (?demo ou ?test) : des données inventées, dans demo/donnees.js, sans réseau ;
//   - en direct : le Worker (config.direct), qui garde un token et un cache partagé, prévenu par les webhooks ;
//   - sinon : GitHub lui-même, sans token (60 appels par heure), avec un cache de config.cacheMinutes.

import { config, depotJeu } from './config.js';

const parametres = new URLSearchParams(location.search);

export const modeTest = parametres.has('test');
export const modeDemo = modeTest || parametres.has('demo');
const adresse = parametres.has('sans-direct') ? '' : (parametres.get('direct') ?? config.direct);
export const adresseDirect = modeDemo ? '' : adresse.replace(/\/+$/, '');
export const modeDirect = Boolean(adresseDirect);

// Ce que l'en-tête affiche : appels restants, limite atteinte, Worker injoignable.
export const infos = { restants: null, reset: null, limiteAtteinte: false, secours: false };
const abonnes = new Set();
export function surInfos(fonction) {
  abonnes.add(fonction);
}
function prevenir() {
  for (const fonction of abonnes) fonction(infos);
}

// Plusieurs widgets demandent souvent la même chose (les issues servent aux idées, aux tâches et à
// l'avancée) : pendant 10 secondes, une même demande ne part qu'une fois.
const memoire = new Map();
const MEMOIRE_MS = 10_000;

export function oublier() {
  memoire.clear();
}

export function api(chemin, { force = false } = {}) {
  const deja = memoire.get(chemin);
  if (deja && Date.now() - deja.t < MEMOIRE_MS) return deja.promesse;
  const promesse = recuperer(chemin, force);
  memoire.set(chemin, { t: Date.now(), promesse });
  promesse.catch(() => memoire.delete(chemin));
  return promesse;
}

async function recuperer(chemin, force) {
  if (modeDemo) return depuisDemo(chemin);
  if (modeDirect) {
    try {
      const donnees = await lireJson(`${adresseDirect}/api${chemin}`);
      if (infos.secours) {
        infos.secours = false;
        prevenir();
      }
      return donnees;
    } catch (erreur) {
      if (erreur.status) throw erreur; // le Worker a répondu : l'erreur est la vraie
      infos.secours = true; // le Worker ne répond pas : on lit GitHub nous-mêmes
      prevenir();
    }
  }
  return depuisGithub(chemin, force);
}

async function lireJson(url) {
  const reponse = await fetch(url, { cache: 'no-store' });
  if (!reponse.ok) throw erreurHttp(`${reponse.status} pour ${url}`, reponse.status);
  return reponse.json();
}

function erreurHttp(message, status) {
  return Object.assign(new Error(message), { status });
}

// --- GitHub sans token -----------------------------------------------------------------------

const PREFIXE = 'dungeoncoop:gh:';
const IMMUABLE = /\/commits\/[0-9a-f]{40}$/; // un commit précis ne change jamais

function lireCache(chemin) {
  try {
    return JSON.parse(localStorage.getItem(PREFIXE + chemin));
  } catch {
    return null;
  }
}

function ecrireCache(chemin, donnees) {
  try {
    localStorage.setItem(PREFIXE + chemin, JSON.stringify({ t: Date.now(), donnees }));
  } catch {
    // Stockage plein ou interdit : on vide nos entrées, la page marche quand même sans cache.
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIXE)).forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}

async function depuisGithub(chemin, force) {
  const cache = lireCache(chemin);
  const age = cache ? Date.now() - cache.t : Infinity;
  if (cache && (IMMUABLE.test(chemin) || (!force && age < config.cacheMinutes * 60_000))) return cache.donnees;

  let reponse;
  try {
    // Pas d'en-tête ajouté : la requête reste « simple » pour le navigateur (pas de pré-vol CORS).
    reponse = await fetch(`https://api.github.com${chemin}`, { cache: 'no-store' });
  } catch {
    if (cache) return cache.donnees;
    throw new Error('GitHub ne répond pas. Pas de connexion internet ?');
  }

  const restants = reponse.headers.get('x-ratelimit-remaining');
  if (restants !== null) {
    infos.restants = Number(restants);
    infos.reset = Number(reponse.headers.get('x-ratelimit-reset')) * 1000;
    infos.limiteAtteinte = infos.restants === 0;
    prevenir();
  }

  if (reponse.ok) {
    const donnees = await reponse.json();
    ecrireCache(chemin, donnees);
    return donnees;
  }
  if ((reponse.status === 403 || reponse.status === 429) && infos.restants === 0) {
    infos.limiteAtteinte = true;
    prevenir();
    if (cache) return cache.donnees; // mieux vaut des données d'il y a un moment que rien
    const retour = new Date(infos.reset).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    throw erreurHttp(`GitHub limite à 60 appels par heure sans token. Retour à ${retour}.`, reponse.status);
  }
  throw erreurHttp(`GitHub a répondu ${reponse.status} pour ${chemin}`, reponse.status);
}

// --- La session (le mot de passe de la plateforme) ----------------------------------------

// { nom, jeton } quand la page est servie par la porte (porte/index.js) et qu'on est connecté.
// Sur ton ordi (outils/serveur.mjs) ou en démo, il n'y a pas de porte : null, et « Je suis » sert à la place.
export async function session() {
  if (modeDemo) return null;
  try {
    const reponse = await fetch('/session', { cache: 'no-store', credentials: 'same-origin' });
    if (!reponse.ok) return null;
    const donnees = await reponse.json();
    return donnees?.nom ? donnees : null;
  } catch {
    return null;
  }
}

// --- Fichiers ------------------------------------------------------------------------------

// Un fichier texte du repo du jeu (GAME_SPEC.md).
export async function fichier(nom, { force = false } = {}) {
  if (modeDemo) {
    const texte = (await donneesDemo()).fichiers[nom];
    if (texte == null) throw erreurHttp(`Démo : pas de fichier ${nom}`, 404);
    return texte;
  }
  if (modeDirect && !infos.secours) {
    try {
      const reponse = await api(`/repos/${depotJeu}/contents/${nom}`, { force });
      return decoderBase64(reponse.content);
    } catch (erreur) {
      if (erreur.status) throw erreur;
    }
  }
  // raw.githubusercontent.com ne compte pas dans les 60 appels, mais GitHub le garde 5 minutes en cache.
  const reponse = await fetch(`https://raw.githubusercontent.com/${depotJeu}/main/${nom}`, { cache: 'no-store' });
  if (!reponse.ok) throw erreurHttp(`${nom} introuvable sur main (${reponse.status})`, reponse.status);
  return reponse.text();
}

function decoderBase64(base64) {
  const binaire = atob(String(base64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
}

// Un fichier JSON du dashboard lui-même (liens.json, equipe.json). En démo, la démo peut le remplacer.
export async function local(nom) {
  if (modeDemo) {
    const remplace = (await donneesDemo()).local[nom];
    if (remplace) return remplace;
  }
  const reponse = await fetch(nom, { cache: 'no-store' });
  if (!reponse.ok) throw erreurHttp(`${nom} introuvable (${reponse.status})`, reponse.status);
  return reponse.json();
}

// --- Démo ----------------------------------------------------------------------------------

let demo = null;
function donneesDemo() {
  demo ??= import('../demo/donnees.js').then((module) => module.donnees());
  return demo;
}

async function depuisDemo(chemin) {
  const reponse = (await donneesDemo()).api[chemin];
  if (reponse === undefined) throw erreurHttp(`Démo : pas de données pour ${chemin}`, 404);
  return structuredClone(reponse);
}
