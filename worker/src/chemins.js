// Les seuls chemins de l'API GitHub que le Worker accepte de lire avec son token, et le « sujet » de chacun.
// Un sujet = ce qu'un webhook rend périmé (prs, commits, issues). null = ne change jamais (un commit précis).

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function depotsDe(env) {
  return String(env.DEPOTS ?? '').split(',').map((d) => d.trim()).filter(Boolean);
}

export function regles(depots) {
  const d = `(?:${depots.map(echapper).join('|')})`;
  const q = '(?:\\?[a-z_]+=[a-z0-9_]+(?:&[a-z_]+=[a-z0-9_]+)*)?'; // ?state=open&per_page=50
  const sha = '[0-9a-f]{40}';
  const r = (motif, sujet, extra = {}) => ({ re: new RegExp(`^/repos/${d}/${motif}$`, 'i'), sujet, ...extra });
  return [
    r(`pulls${q}`, 'prs'),
    r(`pulls/\\d+${q}`, 'prs', { mergeable: true }),
    r(`pulls/\\d+/reviews${q}`, 'prs'),
    r(`commits/${sha}/check-runs${q}`, 'prs'),
    r(`commits/${sha}`, null),
    r(`commits${q}`, 'commits'),
    r(`activity${q}`, 'commits'),
    r('contents/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*\\.md', 'commits'),
    r(`issues${q}`, 'issues'),
    r(`milestones${q}`, 'issues'),
  ];
}

export function regle(chemin, liste) {
  return liste.find((r) => r.re.test(chemin)) ?? null;
}
