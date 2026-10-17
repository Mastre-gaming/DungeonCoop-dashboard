// La connexion GitHub, pour modifier les issues depuis le tableau de travail.
// Le Worker (worker/src/connexion.js) fait l'aller-retour avec GitHub et rend le token dans l'adresse
// (#jeton=…). On le garde dans ce navigateur et on écrit dans GitHub directement : c'est GitHub qui dit
// qui a le droit (les membres qui ont l'écriture sur le repo du jeu). Le token ne part que vers api.github.com.
//
// En démo (?demo, ?test), « se connecter » ne quitte pas la page et les écritures changent les données inventées.

import { adresseDirect, modeDemo, ecrireDemo } from './github.js';

const CLE = 'dungeoncoop:jeton';

export const session = { jeton: null, utilisateur: null, erreur: null };

function lire() {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

function ecrire(valeur) {
  try {
    if (valeur) localStorage.setItem(CLE, valeur);
    else localStorage.removeItem(CLE);
  } catch {}
}

// Au chargement : le Worker vient peut-être de nous rendre un token (ou une erreur) dans le fragment.
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has('jeton') || fragment.has('connexion-erreur')) {
  if (fragment.get('jeton')) ecrire(fragment.get('jeton'));
  session.erreur = fragment.get('connexion-erreur');
  history.replaceState(null, '', location.pathname + location.search); // le token ne reste pas dans l'adresse
}
session.jeton = modeDemo ? null : lire();

// La connexion est-elle branchée sur le Worker ? (Il lui faut l'OAuth App : README, « Le tableau de travail ».)
let disponibilite = null;
export function connexionDisponible() {
  if (modeDemo) return Promise.resolve(true);
  if (!adresseDirect) return Promise.resolve(false);
  disponibilite ??= fetch(`${adresseDirect}/`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((sante) => Boolean(sante.connexion))
    .catch(() => {
      disponibilite = null; // le Worker dort peut-être : on redemandera
      return false;
    });
  return disponibilite;
}

export function seConnecter(loginDemo) {
  if (modeDemo) {
    session.jeton = 'demo';
    session.utilisateur = { login: loginDemo || 'demo-brams', avatar_url: null };
    return;
  }
  const retour = location.origin + location.pathname + location.search;
  location.href = `${adresseDirect}/auth/connexion?retour=${encodeURIComponent(retour)}`;
}

export function seDeconnecter() {
  session.jeton = null;
  session.utilisateur = null;
  if (!modeDemo) ecrire(null);
}

// Qui est connecté. Un token refusé (révoqué sur GitHub) est oublié.
export async function utilisateur() {
  if (!session.jeton) return null;
  if (session.utilisateur) return session.utilisateur;
  try {
    session.utilisateur = await appel('GET', '/user');
  } catch (erreur) {
    if (erreur.status === 401) {
      seDeconnecter();
      session.erreur = 'La connexion GitHub a expiré : reconnecte-toi.';
      return null;
    }
    throw erreur;
  }
  return session.utilisateur;
}

// Une écriture dans l'API GitHub, avec le token. Renvoie la réponse de GitHub (l'issue à jour).
export async function appel(methode, chemin, corps) {
  if (!session.jeton) throw new Error('Connecte-toi d’abord avec GitHub.');
  if (modeDemo) return ecrireDemo(methode, chemin, corps);
  const reponse = await fetch(`https://api.github.com${chemin}`, {
    method: methode,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.jeton}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (reponse.ok) return reponse.json();
  const raison = (await reponse.json().catch(() => ({}))).message ?? '';
  const message = reponse.status === 401 ? 'La connexion GitHub a expiré : reconnecte-toi.'
    : reponse.status === 403 || reponse.status === 404 ? 'GitHub refuse : il faut l’écriture sur le repo du jeu (demande au propriétaire de l’organisation).'
    : reponse.status === 422 ? `GitHub refuse ce changement (${raison || 'données invalides'}).`
    : `GitHub a répondu ${reponse.status}${raison ? ` : ${raison}` : ''}.`;
  throw Object.assign(new Error(message), { status: reponse.status });
}
