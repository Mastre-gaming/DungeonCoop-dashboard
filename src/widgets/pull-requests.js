// PR et conflits : une carte par PR ouverte, avec trois pastilles (tests, conflit, relecture)
// et depuis combien de jours elle attend. Les PR qui te concernent passent en premier.

import { config, urlGithub } from '../config.js';
import { api } from '../github.js';
import { el, lienExterne, avatar, pastille, joursDepuis, dateLongue, vide, nomDe, tagDepot, bouton } from '../outils.js';

export const sujets = ['prs'];

const ROUGE = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);

export async function afficher(ctx) {
  const options = { force: ctx.force };
  const listes = await Promise.all(config.depots.map(async (depot) => {
    const prs = await api(`/repos/${config.organisation}/${depot}/pulls?state=open&per_page=50`, options);
    return prs.map((pr) => ({ pr, depot }));
  }));
  const prs = listes.flat();
  const liensBas = el('p', { class: 'pied' }, 'Toutes les PR : ',
    config.depots.map((depot, i) => [i ? ' · ' : '', lienExterne(`${urlGithub(depot)}/pulls`, {}, config.nomsCourts[depot] ?? depot)]));

  if (!prs.length) {
    ctx.pourToi([]);
    return el('div', {},
      vide('Aucune PR ouverte : tout est fusionné.', bouton(`${urlGithub(config.jeu)}/blob/main/docs/GUIDE_EQUIPE.md`, 'Comment ouvrir une PR', 'discret')),
      liensBas);
  }

  const details = await Promise.all(prs.map((p) => detailler(p, ctx)));
  if (details.some((d) => d.conflit.inconnu)) ctx.relancer(8000); // GitHub calcule encore les conflits

  const pourMoi = (d) => Boolean(ctx.moi) && (d.pr.user?.login === ctx.moi || d.relecture.attendus.includes(ctx.moi));
  details.sort((a, b) => (pourMoi(b) - pourMoi(a)) || (new Date(a.pr.created_at) - new Date(b.pr.created_at)));

  ctx.pourToi(ctx.moi ? details.flatMap((d) => itemsPourMoi(d, ctx.moi)) : []);
  return el('div', {}, el('div', { class: 'liste-pr' }, details.map((d) => carte(d, ctx, pourMoi(d)))), liensBas);
}

async function detailler({ pr, depot }, ctx) {
  const base = `/repos/${config.organisation}/${depot}`;
  const options = { force: ctx.force };
  const rien = () => null; // une info manquante donne une pastille « ? », pas une carte cassée
  const [detail, checks, relectures] = await Promise.all([
    api(`${base}/pulls/${pr.number}`, options).catch(rien),
    api(`${base}/commits/${pr.head.sha}/check-runs?per_page=100`, options).catch(rien),
    api(`${base}/pulls/${pr.number}/reviews?per_page=100`, options).catch(rien),
  ]);
  const nom = (login) => nomDe(login, ctx.equipe);
  return { pr, depot, tests: etatTests(checks), conflit: etatConflit(detail), relecture: etatRelecture(pr, relectures, nom) };
}

function etatTests(checks) {
  if (!checks) return { niveau: 'neutre', texte: 'tests : ?' };
  const runs = checks.check_runs ?? [];
  if (!runs.length) return { niveau: 'neutre', texte: 'pas de tests' };
  if (runs.some((r) => r.status !== 'completed')) return { niveau: 'encours', texte: 'tests en cours' };
  if (runs.some((r) => ROUGE.has(r.conclusion))) return { niveau: 'grave', texte: 'tests rouges', rouge: true };
  return { niveau: 'bon', texte: 'tests verts' };
}

function etatConflit(detail) {
  if (!detail) return { niveau: 'neutre', texte: 'conflit : ?' };
  if (detail.mergeable === false || detail.mergeable_state === 'dirty') return { niveau: 'grave', texte: 'conflit à régler', conflit: true };
  if (detail.mergeable == null || detail.mergeable_state === 'unknown') return { niveau: 'neutre', texte: 'conflit : GitHub vérifie…', inconnu: true };
  if (detail.mergeable_state === 'behind') return { niveau: 'attention', texte: 'en retard sur main' };
  return { niveau: 'bon', texte: 'pas de conflit' };
}

function etatRelecture(pr, relectures, nom) {
  // Le dernier avis de chaque relecteur compte ; un simple commentaire ne change pas l'avis.
  const avis = new Map();
  for (const r of relectures ?? []) {
    if (!r.user || r.state === 'COMMENTED' || r.state === 'PENDING') continue;
    avis.set(r.user.login, r.state);
  }
  const qui = (etatVoulu) => [...avis].filter(([, s]) => s === etatVoulu).map(([login]) => login);
  const changements = qui('CHANGES_REQUESTED');
  const approuvee = qui('APPROVED');
  const attendus = [
    ...(pr.requested_reviewers ?? []).map((u) => u.login),
    ...(pr.requested_teams ?? []).map((t) => `@${t.slug}`),
  ];
  const liste = (logins) => logins.map(nom).join(', ');
  if (relectures === null) return { niveau: 'neutre', texte: 'relecture : ?', attendus };
  if (changements.length) return { niveau: 'attention', texte: `changements demandés par ${liste(changements)}`, attendus, changements };
  if (attendus.length) return { niveau: 'attention', texte: `relecture attendue : ${liste(attendus)}`, attendus };
  if (approuvee.length) return { niveau: 'bon', texte: `approuvée par ${liste(approuvee)}`, attendus };
  return { niveau: 'neutre', texte: 'aucune relecture demandée', attendus };
}

function itemsPourMoi(d, moi) {
  const { pr } = d;
  const ref = `PR #${pr.number} (${config.nomsCourts[d.depot] ?? d.depot})`;
  const items = [];
  if (d.relecture.attendus.includes(moi)) items.push({ niveau: 'attention', texte: `${ref} attend ta relecture`, lien: `${pr.html_url}/files` });
  if (pr.user?.login === moi) {
    if (d.conflit.conflit) items.push({ niveau: 'grave', texte: `Conflit à régler sur ta ${ref}`, lien: `${pr.html_url}/conflicts` });
    if (d.tests.rouge) items.push({ niveau: 'grave', texte: `Tests rouges sur ta ${ref}`, lien: `${pr.html_url}/checks` });
    if (d.relecture.changements) items.push({ niveau: 'attention', texte: `Changements demandés sur ta ${ref}`, lien: pr.html_url });
  }
  return items;
}

function carte(d, ctx, pourMoi) {
  const { pr } = d;
  const jours = joursDepuis(pr.created_at);
  return el('article', { class: `pr${pourMoi ? ' pour-moi' : ''}`, dataset: { numero: pr.number, depot: d.depot } },
    el('div', { class: 'pr-tete' },
      avatar(pr.user, 28),
      el('div', { class: 'pr-titre' },
        lienExterne(pr.html_url, { class: 'titre' }, pr.title),
        el('div', { class: 'meta' },
          tagDepot(d.depot), ` #${pr.number} · ${nomDe(pr.user?.login, ctx.equipe)} · `,
          el('code', {}, pr.head.ref), ' → ', el('code', {}, pr.base.ref),
          pr.draft ? el('span', { class: 'tag' }, 'brouillon') : null,
          pourMoi ? el('span', { class: 'tag toi' }, 'toi') : null)),
      el('div', { class: 'attente', title: `ouverte le ${dateLongue(pr.created_at)}` },
        el('strong', {}, jours === 0 ? 'auj.' : `${jours} j`), el('span', {}, 'd’attente'))),
    el('div', { class: 'pastilles' },
      pastille(d.tests.niveau, d.tests.texte, { lien: `${pr.html_url}/checks` }),
      pastille(d.conflit.niveau, d.conflit.texte, { lien: d.conflit.conflit ? `${pr.html_url}/conflicts` : null }),
      pastille(d.relecture.niveau, d.relecture.texte, { lien: `${pr.html_url}/files` })));
}
