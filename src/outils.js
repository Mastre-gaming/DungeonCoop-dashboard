// Les petits outils partagés par les widgets.
// Règle : on construit la page avec el(), jamais avec innerHTML. Le repo est public, n'importe qui peut
// ouvrir une issue : un titre doit toujours s'afficher comme du texte.

import { config } from './config.js';

export function el(balise, attributs = {}, ...enfants) {
  const noeud = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs ?? {})) {
    if (valeur == null || valeur === false) continue;
    if (cle === 'class') noeud.className = valeur;
    else if (cle === 'dataset') Object.assign(noeud.dataset, valeur);
    else if (cle === 'href' || cle === 'src') noeud.setAttribute(cle, adresseSure(valeur));
    else if (cle.startsWith('on')) noeud.addEventListener(cle.slice(2), valeur);
    else noeud.setAttribute(cle, valeur === true ? '' : valeur);
  }
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant == null || enfant === false) continue;
    noeud.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return noeud;
}

// Seulement http et https : pas de « javascript: » venu d'un fichier ou de GitHub.
export function adresseSure(url) {
  try {
    const u = new URL(url, location.href);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '#';
  } catch {
    return '#';
  }
}

// Un lien qui ouvre GitHub (ou autre) dans un nouvel onglet.
export function lienExterne(url, attributs, ...enfants) {
  return el('a', { ...attributs, href: url, target: '_blank', rel: 'noopener' }, ...enfants);
}

export function bouton(url, texte, classe = '') {
  return lienExterne(url, { class: `bouton ${classe}`.trim() }, texte);
}

export function normaliser(texte) {
  return String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const relatif = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const UNITES = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

export function ilYa(date) {
  const secondes = (new Date(date) - Date.now()) / 1000;
  for (const [unite, duree] of UNITES) {
    if (Math.abs(secondes) >= duree) return relatif.format(Math.round(secondes / duree), unite);
  }
  return 'à l’instant';
}

export function dateLongue(date) {
  return new Date(date).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function heure(date) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function temps(date) {
  return el('time', { datetime: new Date(date).toISOString(), title: dateLongue(date) }, ilYa(date));
}

export function joursDepuis(date) {
  return Math.floor((Date.now() - new Date(date)) / 86400000);
}

export function avatar(utilisateur, taille = 24) {
  const login = utilisateur?.login ?? '?';
  if (utilisateur?.avatar_url) {
    const sep = utilisateur.avatar_url.includes('?') ? '&' : '?';
    return el('img', { class: 'avatar', src: `${utilisateur.avatar_url}${sep}s=${taille * 2}`, alt: '', width: taille, height: taille, loading: 'lazy' });
  }
  const initiales = login.replace(/^demo-/, '').slice(0, 2).toUpperCase();
  return el('span', { class: 'avatar initiales', style: `--taille:${taille}px`, 'aria-hidden': 'true' }, initiales);
}

// Le nom affiché : celui d'equipe.json s'il est rempli, sinon le pseudo GitHub.
export function nomDe(login, equipe = []) {
  const membre = equipe.find((m) => normaliser(m.github) === normaliser(login));
  return membre?.nom || login;
}

// Une pastille d'état : toujours une icône et un texte, jamais la couleur seule.
const ICONES = { bon: '✓', attention: '!', grave: '✕', encours: '…', neutre: '–' };

export function pastille(niveau, texte, { lien, titre } = {}) {
  const contenu = [el('span', { class: 'icone', 'aria-hidden': 'true' }, ICONES[niveau] ?? '–'), el('span', {}, texte)];
  const attributs = { class: `pastille ${niveau}`, title: titre, dataset: { niveau } };
  return lien ? lienExterne(lien, attributs, contenu) : el('span', attributs, contenu);
}

export function tagDepot(depot) {
  const court = config.nomsCourts[depot] ?? depot;
  return el('span', { class: `tag depot depot-${normaliser(court).replace(/[^a-z0-9]+/g, '-')}` }, court);
}

export function vide(texte, ...actions) {
  return el('div', { class: 'vide' }, el('p', {}, texte), actions.length ? el('div', { class: 'actions' }, actions) : null);
}

export function aLeLabel(issue, nom) {
  return (issue.labels ?? []).some((l) => normaliser(l.name ?? l) === normaliser(nom));
}

export function estIdee(issue) {
  return aLeLabel(issue, config.labelIdee);
}

// « priorité: haute » → « haute ». Accepte aussi « priorite haute » ou « Priorité : Haute ».
export function prioriteDe(issue) {
  const prefixe = normaliser(config.prefixePriorite).replace(/[:\s]+$/, '');
  for (const label of issue.labels ?? []) {
    const nom = normaliser(label.name ?? label);
    const m = nom.match(new RegExp(`^${prefixe}\\s*:?\\s*(\\S+)`));
    if (m) return m[1];
  }
  return null;
}

// Le jalon d'une issue rangé sur un nom de config.jalons (« D1 : The paper fight » → « D1 »).
export function jalonDe(issue) {
  const titre = issue.milestone?.title;
  if (!titre) return null;
  return nomDeJalon(titre);
}

export function nomDeJalon(titre) {
  const n = normaliser(titre);
  for (const jalon of [...config.jalons, config.parking]) {
    const j = normaliser(jalon);
    if (n === j || (n.startsWith(j) && !/[a-z0-9]/.test(n[j.length]))) return jalon;
  }
  return titre;
}
