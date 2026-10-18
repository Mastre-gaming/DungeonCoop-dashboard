// La connexion GitHub, pour modifier les issues depuis le tableau de travail.
// Le Worker (worker/src/connexion.js) fait l'aller-retour avec GitHub et rend le token dans l'adresse
// (#jeton=…). On le garde dans ce navigateur et on écrit dans GitHub directement : c'est GitHub qui dit
// qui a le droit (les membres qui ont l'écriture sur le repo du jeu). Le token part vers api.github.com, et vers
// le Worker quand on change son pseudo : il le montre à GitHub pour savoir qui on est, sans le garder.
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

// La connexion est-elle branchée sur le Worker ? (Il lui faut la GitHub App : README, « Le tableau de travail ».)
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

// Qui est connecté a changé (connexion, déconnexion, token expiré) : le profil de l'en-tête et main.js écoutent.
const prevenir = () => document.dispatchEvent(new Event('dungeoncoop:github'));

export function seConnecter(loginDemo) {
  if (modeDemo) {
    session.jeton = 'demo';
    session.utilisateur = { login: loginDemo || 'demo-brams', avatar_url: null };
    prevenir();
    return;
  }
  const retour = location.origin + location.pathname + location.search;
  location.href = `${adresseDirect}/auth/connexion?retour=${encodeURIComponent(retour)}`;
}

export function seDeconnecter() {
  session.jeton = null;
  session.utilisateur = null;
  if (!modeDemo) ecrire(null);
  prevenir();
}

// Qui est connecté. Un token refusé (révoqué sur GitHub) est oublié. Le profil et le tableau le demandent
// en même temps au chargement : une seule question part vers GitHub.
let enCours = null;
export function utilisateur() {
  if (!session.jeton) return Promise.resolve(null);
  if (session.utilisateur) return Promise.resolve(session.utilisateur);
  enCours ??= appel('GET', '/user')
    .then((qui) => {
      session.utilisateur = qui;
      prevenir();
      return qui;
    })
    .catch((erreur) => {
      if (erreur.status !== 401) throw erreur;
      seDeconnecter();
      session.erreur = 'La connexion GitHub a expiré : reconnecte-toi.';
      return null;
    })
    .finally(() => (enCours = null));
  return enCours;
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
