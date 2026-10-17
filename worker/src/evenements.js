// Traduit un webhook GitHub en ce que les pages doivent savoir :
//   sujets  : les widgets à redessiner ('prs', 'commits', 'issues') ;
//   message : une phrase en français pour la notification, ou null si l'événement ne mérite pas d'en faire une.

const ROUGE = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);

const couper = (texte, max = 70) => {
  const ligne = String(texte ?? '').split('\n')[0].trim();
  return ligne.length > max ? `${ligne.slice(0, max - 1)}…` : ligne;
};
const sansAccents = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function traduire(evenement, p) {
  const depot = p.repository?.name ?? '';
  const qui = p.sender?.login ?? 'Quelqu’un';
  const message = (texte, lien) => (texte ? { texte, lien: lien ?? p.repository?.html_url ?? null, depot, acteur: qui } : null);

  switch (evenement) {
    case 'ping':
      return { sujets: [], message: message(`Webhook branché sur ${depot} ✔`) };

    case 'push': {
      const branche = String(p.ref ?? '').replace(/^refs\/(heads|tags)\//, '');
      const sujets = ['commits', 'prs'];
      if (p.deleted) return { sujets, message: message(`${qui} a supprimé la branche ${branche}`) };
      const n = p.commits?.length ?? 0;
      if (p.created && n === 0) return { sujets, message: message(`${qui} a créé la branche ${branche}`, p.compare) };
      const titre = p.head_commit?.message ? ` : « ${couper(p.head_commit.message)} »` : '';
      return { sujets, message: message(`${qui} a poussé ${pluriel(n, 'commit')} sur ${branche}${titre}`, p.compare ?? p.head_commit?.url) };
    }

    case 'pull_request': {
      const pr = p.pull_request ?? {};
      const ref = `la PR #${pr.number} « ${couper(pr.title, 60)} »`;
      const textes = {
        opened: `${qui} a ouvert ${ref}`,
        reopened: `${qui} a rouvert ${ref}`,
        ready_for_review: `${qui} : ${ref} est prête à relire`,
        review_requested: p.requested_reviewer ? `${qui} demande à ${p.requested_reviewer.login} de relire la PR #${pr.number}` : null,
        closed: pr.merged ? `${qui} a fusionné ${ref}` : `${qui} a fermé la PR #${pr.number} sans la fusionner`,
      };
      return { sujets: pr.merged ? ['prs', 'commits'] : ['prs'], message: message(textes[p.action], pr.html_url) };
    }

    case 'pull_request_review': {
      if (p.action !== 'submitted') return { sujets: ['prs'], message: null };
      const n = p.pull_request?.number;
      const textes = {
        approved: `${qui} a approuvé la PR #${n}`,
        changes_requested: `${qui} demande des changements sur la PR #${n}`,
        commented: `${qui} a commenté la PR #${n}`,
      };
      return { sujets: ['prs'], message: message(textes[sansAccents(p.review?.state)], p.review?.html_url) };
    }

    case 'check_suite': {
      // Seulement les tests de GitHub Actions : l'aperçu Cloudflare a aussi ses « checks », on ne le notifie pas.
      const suite = p.check_suite ?? {};
      const prs = (suite.pull_requests ?? []).map((pr) => `#${pr.number}`).join(', ');
      if (p.action !== 'completed' || suite.app?.slug !== 'github-actions' || !prs) return { sujets: ['prs'], message: null };
      if (suite.conclusion === 'success') return { sujets: ['prs'], message: message(`Tests verts sur la PR ${prs}`) };
      if (ROUGE.has(suite.conclusion)) return { sujets: ['prs'], message: message(`Tests rouges sur la PR ${prs}`) };
      return { sujets: ['prs'], message: null };
    }

    case 'check_run':
    case 'status':
    case 'pull_request_review_comment':
      return { sujets: ['prs'], message: null };

    case 'issues': {
      const issue = p.issue ?? {};
      const idee = (issue.labels ?? []).some((l) => sansAccents(l.name) === 'idee');
      const ref = `#${issue.number} « ${couper(issue.title, 60)} »`;
      const textes = {
        opened: idee ? `${qui} propose une idée : « ${couper(issue.title, 60)} »` : `${qui} a ouvert l’issue ${ref}`,
        closed: `${qui} a fermé ${ref}`,
        reopened: `${qui} a rouvert ${ref}`,
        assigned: p.assignee?.login === qui ? `${qui} prend ${ref}` : `${qui} confie ${ref} à ${p.assignee?.login}`,
      };
      return { sujets: ['issues'], message: message(textes[p.action], issue.html_url) };
    }

    case 'issue_comment': {
      if (p.action !== 'created') return { sujets: [], message: null };
      const issue = p.issue ?? {};
      return {
        sujets: issue.pull_request ? [] : ['issues'],
        message: message(`${qui} a commenté #${issue.number} « ${couper(issue.title, 50)} »`, p.comment?.html_url),
      };
    }

    case 'milestone':
    case 'label':
      return { sujets: ['issues'], message: null };

    case 'create':
    case 'delete':
      return { sujets: ['commits'], message: null };

    default:
      return { sujets: [], message: null };
  }
}
