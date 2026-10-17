// Les idées : les issues ouvertes avec le label « idée », rangées par jalon (le « quand »),
// puis triées par priorité (label « priorité: haute / moyenne / basse ») et par votes 👍.
// La priorité décide, les votes départagent.

import { config, depotJeu, urlGithub } from '../config.js';
import { api } from '../github.js';
import { el, lienExterne, avatar, vide, nomDe, estIdee, jalonDe, prioriteDe, bouton, normaliser } from '../outils.js';

export const sujets = ['issues'];

const PRIORITES = ['haute', 'moyenne', 'basse'];
const A_TRIER = 'À trier';

export async function afficher(ctx) {
  const idees = (await api(`/repos/${depotJeu}/issues?state=open&per_page=100`, { force: ctx.force }))
    .filter((i) => !i.pull_request && estIdee(i));
  const nouvelle = bouton(`${urlGithub()}/issues/new?template=idee.md`, '💡 Nouvelle idée');

  if (!idees.length) {
    return vide('Pas encore d’idée. Une idée = une issue avec le modèle « Idée » : elle reçoit toujours une réponse.', nouvelle);
  }

  // Les colonnes dans l'ordre du temps : à trier, D1 … M4, puis le parking. Seules celles qui ont des idées.
  const ordre = [A_TRIER, ...config.jalons, config.parking];
  const colonnes = new Map();
  for (const idee of idees) {
    const jalon = jalonDe(idee) ?? A_TRIER;
    if (!ordre.includes(jalon)) ordre.splice(ordre.length - 1, 0, jalon); // un jalon inconnu, avant le parking
    if (!colonnes.has(jalon)) colonnes.set(jalon, []);
    colonnes.get(jalon).push(idee);
  }
  for (const liste of colonnes.values()) liste.sort(comparer);

  return el('div', {},
    el('div', { class: 'colonnes' },
      ordre.filter((j) => colonnes.has(j)).map((jalon) =>
        el('section', { class: `colonne${jalon === A_TRIER ? ' a-trier' : ''}`, dataset: { jalon } },
          el('h3', {}, el('span', {}, jalon), el('span', { class: 'compte' }, colonnes.get(jalon).length)),
          el('ul', {}, colonnes.get(jalon).map((idee) => carte(idee, ctx)))))),
    el('p', { class: 'pied' }, nouvelle, ' ',
      el('span', { class: 'muet' }, 'Pour voter : ouvre l’idée et ajoute un 👍 au premier message.')));
}

function rang(idee) {
  const p = prioriteDe(idee);
  const i = p ? PRIORITES.indexOf(normaliser(p)) : -1;
  return i < 0 ? PRIORITES.length : i;
}

const votes = (idee) => idee.reactions?.['+1'] ?? 0;

function comparer(a, b) {
  return rang(a) - rang(b) || votes(b) - votes(a) || new Date(a.created_at) - new Date(b.created_at);
}

function carte(idee, ctx) {
  const priorite = prioriteDe(idee);
  // Le modèle « Idée » met « [Idée] » devant le titre : inutile ici, la colonne le dit déjà.
  const titre = idee.title.replace(/^\s*\[\s*id[ée]e\s*\]\s*/i, '') || idee.title;
  return el('li', { class: 'idee', dataset: { numero: idee.number, priorite: priorite ?? '' } },
    lienExterne(idee.html_url, { class: 'titre' }, titre),
    el('div', { class: 'meta' },
      priorite ? el('span', { class: `prio prio-${normaliser(priorite)}` }, `priorité ${priorite}`) : el('span', { class: 'prio' }, 'sans priorité'),
      el('span', { class: 'votes', title: `${votes(idee)} vote${votes(idee) > 1 ? 's' : ''} 👍` }, '👍 ', votes(idee)),
      idee.comments ? el('span', { title: 'commentaires' }, '💬 ', idee.comments) : null,
      el('span', { class: 'auteur', title: `proposée par ${nomDe(idee.user?.login, ctx.equipe)}` }, avatar(idee.user, 18), ` #${idee.number}`)));
}
