// Derniers push et commits : qui a poussé quoi, sur quelle branche, il y a combien de temps.
// La source est l'« activité » du repo (à jour tout de suite), pas les « events » de GitHub,
// qui peuvent avoir plusieurs heures de retard.

import { config, urlGithub } from '../config.js';
import { api } from '../github.js';
import { el, lienExterne, avatar, temps, vide, nomDe, tagDepot } from '../outils.js';

export const sujets = ['commits'];

const VERBES = {
  push: 'a poussé sur',
  force_push: 'a forcé un push sur',
  branch_creation: 'a créé la branche',
  branch_deletion: 'a supprimé la branche',
  pr_merge: 'a fusionné une PR dans',
  merge_queue_merge: 'a fusionné une PR dans',
};

export async function afficher(ctx) {
  const options = { force: ctx.force };
  const parDepot = await Promise.all(config.depots.map(async (depot) => {
    const base = `/repos/${config.organisation}/${depot}`;
    const [activite, commitsMain] = await Promise.all([
      api(`${base}/activity?per_page=15`, options),
      api(`${base}/commits?per_page=10`, options).catch(() => []),
    ]);
    const parSha = new Map(commitsMain.map((c) => [c.sha, c]));
    return activite.map((a) => ({ ...a, depot, commit: parSha.get(a.after) }));
  }));

  const entrees = parDepot.flat().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 12);
  if (!entrees.length) return vide('Aucun push pour l’instant.');

  // Le message d'un push sur une autre branche que main : un appel par commit, gardé pour toujours
  // (un commit ne change jamais). Quatre au plus par chargement.
  const sansMessage = entrees.filter((e) => !e.commit && e.after && !/^0+$/.test(e.after) && e.activity_type !== 'branch_deletion');
  await Promise.all(sansMessage.slice(0, 4).map(async (e) => {
    e.commit = await api(`/repos/${config.organisation}/${e.depot}/commits/${e.after}`, options).catch(() => null);
  }));

  return el('div', {},
    el('ol', { class: 'fil' }, entrees.map((e) => ligne(e, ctx))),
    el('p', { class: 'pied' }, 'Toute l’activité : ',
      config.depots.map((depot, i) => [i ? ' · ' : '', lienExterne(`${urlGithub(depot)}/activity`, {}, config.nomsCourts[depot] ?? depot)])));
}

function ligne(e, ctx) {
  const branche = (e.ref ?? '').replace(/^refs\/(heads|tags)\//, '');
  const message = e.commit?.commit?.message?.split('\n')[0];
  const lienCommit = e.commit?.html_url;
  const lienBranche = `${urlGithub(e.depot)}/tree/${branche.split('/').map(encodeURIComponent).join('/')}`;
  return el('li', { class: `evenement ${e.activity_type}`, dataset: { type: e.activity_type } },
    avatar(e.actor, 24),
    el('div', { class: 'quoi' },
      el('div', {},
        el('strong', {}, nomDe(e.actor?.login, ctx.equipe)), ' ', VERBES[e.activity_type] ?? e.activity_type, ' ',
        e.activity_type === 'branch_deletion' ? el('code', {}, branche) : lienExterne(lienBranche, {}, el('code', {}, branche)),
        ' ', tagDepot(e.depot)),
      message ? el('div', { class: 'message' }, lienCommit ? lienExterne(lienCommit, {}, message) : message) : null),
    temps(e.timestamp));
}
