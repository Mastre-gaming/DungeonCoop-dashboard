// La connexion GitHub du tableau de travail (GitHub App, connexion de l'utilisateur : « web application flow »).
//
//   GET /auth/connexion?retour=<adresse de la page>   envoie chez GitHub, qui demande l'accord
//   GET /auth/retour?code=…&state=…                    échange le code contre un token et renvoie à la page
//
// Le token repart dans le fragment de l'adresse (#jeton=…) : un fragment ne passe par aucun serveur,
// et le Worker ne garde rien. La page le garde dans le navigateur et écrit dans GitHub elle-même :
// c'est GitHub qui décide qui a le droit (les membres qui ont l'écriture sur le repo du jeu).
//
// Deux réglages : GITHUB_CLIENT_ID (vars, public) et GITHUB_CLIENT_SECRET (secret), ceux de la GitHub App.
// PAGES dit vers quelles pages un token peut repartir : sans cette liste, n'importe quel site pourrait
// demander « renvoie-moi le token » en se faisant passer pour le dashboard.

import { signatureValide, signer } from './signature.js';

// Une GitHub App ignore le scope : c'est sa permission (Issues, sur DungeonCoop seulement) qui décide.
// Il ne servirait qu'avec une OAuth App, où public_repo ouvrirait tous les repos publics de la personne.
const PORTEE = 'public_repo';
const VALIDITE_MS = 10 * 60_000;

export function connexionPrete(env) {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

// « https://*-dungeoncoop-dashboard.mastredev.workers.dev » : * = un morceau d'adresse (les aperçus de branche).
export function pagesDe(env) {
  return String(env.PAGES ?? '').split(',').map((p) => p.trim().replace(/\/+$/, '')).filter(Boolean);
}

export function pageAutorisee(retour, pages) {
  let url;
  try {
    url = new URL(retour);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  return pages.some((page) => {
    const motif = page.split('*').map((morceau) => morceau.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+');
    return new RegExp(`^${motif}$`, 'i').test(url.origin);
  });
}

const enBase64 = (texte) => btoa(String.fromCharCode(...new TextEncoder().encode(texte))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64 = (texte) => new TextDecoder().decode(Uint8Array.from(atob(texte.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

// Le « state » d'OAuth : la page de retour et l'heure, signés. GitHub nous le rend tel quel ; la signature
// prouve que c'est bien nous qui avons lancé cette connexion, pour cette page, il y a moins de 10 minutes.
export async function etatSigne(secret, retour, maintenant = Date.now()) {
  const contenu = enBase64(JSON.stringify({ r: retour, t: maintenant }));
  return `${contenu}.${(await signer(secret, contenu)).slice('sha256='.length)}`;
}

export async function lireEtat(secret, etat, maintenant = Date.now()) {
  const [contenu, signature] = String(etat ?? '').split('.');
  if (!contenu || !signature) return null;
  if (!(await signatureValide(secret, contenu, `sha256=${signature}`))) return null;
  try {
    const { r, t } = JSON.parse(deBase64(contenu));
    if (typeof r !== 'string' || !(maintenant - t < VALIDITE_MS && t <= maintenant + 60_000)) return null;
    return r;
  } catch {
    return null;
  }
}

const texte = (corps, status) => new Response(corps, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

function retourner(page, fragment) {
  const url = new URL(page);
  url.hash = fragment;
  return new Response(null, { status: 302, headers: { Location: url.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

export async function connexion(requete, env) {
  const url = new URL(requete.url);
  if (!connexionPrete(env)) return texte('La connexion GitHub n’est pas encore branchée : il manque GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET (README, « Le tableau de travail »).', 503);
  const pages = pagesDe(env);
  const adresseRetour = `${url.origin}/auth/retour`;

  if (url.pathname === '/auth/connexion') {
    const retour = url.searchParams.get('retour') ?? '';
    if (!pageAutorisee(retour, pages)) return texte('Cette page n’est pas dans PAGES : le Worker ne lui enverra pas de token.', 400);
    const github = new URL('https://github.com/login/oauth/authorize');
    github.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    github.searchParams.set('redirect_uri', adresseRetour);
    github.searchParams.set('scope', PORTEE);
    github.searchParams.set('state', await etatSigne(env.GITHUB_CLIENT_SECRET, retour));
    github.searchParams.set('allow_signup', 'false');
    return Response.redirect(github.href, 302);
  }

  if (url.pathname === '/auth/retour') {
    const retour = await lireEtat(env.GITHUB_CLIENT_SECRET, url.searchParams.get('state'));
    if (!retour || !pageAutorisee(retour, pages)) return texte('Connexion expirée ou venue d’ailleurs. Recommence depuis le dashboard.', 400);
    if (url.searchParams.get('error')) return retourner(retour, `connexion-erreur=${encodeURIComponent('Connexion annulée sur GitHub.')}`);

    const reponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'dungeoncoop-direct' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: url.searchParams.get('code') ?? '',
        redirect_uri: adresseRetour,
      }),
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !donnees.access_token) {
      return retourner(retour, `connexion-erreur=${encodeURIComponent(`GitHub a refusé la connexion (${donnees.error ?? reponse.status}).`)}`);
    }
    return retourner(retour, `jeton=${encodeURIComponent(donnees.access_token)}`);
  }

  return texte('Rien ici.', 404);
}
