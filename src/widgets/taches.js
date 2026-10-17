// Répartition des tâches : une colonne par personne, plus une colonne pour ce que personne n'a pris.
// Une tâche = une issue ouverte du jeu. Une idée n'en devient une que quand quelqu'un la prend.

import { config, depotJeu, urlGithub } from '../config.js';
import { api, modeDemo } from '../github.js';
import { el, lienExterne, avatar, vide, nomDe, estIdee, jalonDe, bouton, normaliser } from '../outils.js';

export const sujets = ['issues'];

export async function afficher(ctx) {
  const issues = (await api(`/repos/${depotJeu}/issues?state=open&per_page=100`, { force: ctx.force }))
    .filter((i) => !i.pull_request);
  const taches = issues.filter((i) => i.assignees?.length || !estIdee(i));
  const nouvelle = bouton(`${urlGithub()}/issues/new/choose`, 'Créer une issue', 'discret');

  if (!taches.length) {
    ctx.pourToi([]);
    return vide('Aucune tâche ouverte. Les tâches sont les issues du jeu.', nouvelle);
  }

  // Une colonne par membre d'equipe.json, même vide, puis toute autre personne assignée. « Moi » d'abord.
  const membre = (login) => ({ login, avatar_url: modeDemo ? null : `https://avatars.githubusercontent.com/${encodeURIComponent(login)}` });
  const colonnes = new Map(ctx.equipe.map((m) => [m.github, { utilisateur: membre(m.github), taches: [] }]));
  const personne = [];
  for (const tache of taches) {
    if (!tache.assignees?.length) personne.push(tache);
    for (const a of tache.assignees ?? []) {
      const cle = [...colonnes.keys()].find((k) => normaliser(k) === normaliser(a.login)) ?? a.login;
      if (!colonnes.has(cle)) colonnes.set(cle, { utilisateur: a, taches: [] });
      const colonne = colonnes.get(cle);
      colonne.utilisateur = a; // a l'avatar
      colonne.taches.push(tache);
    }
  }
  const ordre = [...colonnes.entries()].sort(([a], [b]) => (b === ctx.moi) - (a === ctx.moi));

  const miennes = colonnes.get(ctx.moi)?.taches ?? [];
  ctx.pourToi(miennes.length ? [{
    niveau: 'neutre',
    texte: `${miennes.length} tâche${miennes.length > 1 ? 's' : ''} à toi`,
    lien: `${urlGithub()}/issues?q=${encodeURIComponent(`is:open assignee:${ctx.moi}`)}`,
  }] : []);

  return el('div', {},
    el('div', { class: 'colonnes' },
      ordre.map(([login, colonne]) => el('section', { class: `colonne${login === ctx.moi ? ' pour-moi' : ''}`, dataset: { personne: login } },
        el('h3', {}, avatar(colonne.utilisateur, 22), el('span', {}, nomDe(login, ctx.equipe)), el('span', { class: 'compte' }, colonne.taches.length)),
        colonne.taches.length ? el('ul', {}, colonne.taches.map(carte)) : el('p', { class: 'muet' }, 'Rien d’assigné.'))),
      el('section', { class: 'colonne personne', dataset: { personne: '' } },
        el('h3', {}, el('span', { class: 'avatar initiales', 'aria-hidden': 'true' }, '?'), el('span', {}, 'Personne'), el('span', { class: 'compte' }, personne.length)),
        personne.length
          ? [el('ul', {}, personne.map(carte)), el('p', { class: 'astuce' }, 'Pour en prendre une : ouvre-la, puis « assign yourself » à droite.')]
          : el('p', { class: 'muet' }, 'Tout est pris.'))),
    el('p', { class: 'pied' }, lienExterne(`${urlGithub()}/issues`, {}, 'Toutes les issues'), ' · ', nouvelle));
}

function carte(issue) {
  const jalon = jalonDe(issue);
  const etiquettes = (issue.labels ?? []).map((l) => l.name).filter((n) => !normaliser(n).startsWith('priorite') && normaliser(n) !== normaliser(config.labelIdee));
  return el('li', { class: 'tache', dataset: { numero: issue.number } },
    lienExterne(issue.html_url, { class: 'titre' }, issue.title),
    el('div', { class: 'meta' },
      `#${issue.number}`,
      jalon ? el('span', { class: 'tag tag-jalon' }, jalon) : null,
      estIdee(issue) ? el('span', { class: 'tag' }, 'idée') : null,
      etiquettes.map((n) => el('span', { class: 'tag' }, n))));
}
