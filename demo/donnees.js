// Des données inventées, pour voir la page remplie (?demo) et pour les tests (?test), sans réseau.
// Les personnes sont fictives (demo-…). Chaque clé de « api » est exactement le chemin qu'un widget demande :
// si tu changes un chemin dans un widget, change-le ici aussi.

const O = 'Mastre-gaming';
const JEU = 'DungeonCoop';
const DASH = 'DungeonCoop-dashboard';

export function donnees() {
  const maintenant = Date.now();
  const il = (heures) => new Date(maintenant - heures * 3600_000).toISOString();
  let compteur = 0;
  const sha = () => (++compteur).toString(16).padStart(4, '0') + 'dead'.repeat(9);
  const qui = (login) => ({ login, html_url: `https://github.com/${login}` });
  const gh = (depot, suite) => `https://github.com/${O}/${depot}${suite}`;
  const base = (depot) => `/repos/${O}/${depot}`;
  const api = {};

  // --- PR -------------------------------------------------------------------------------
  function pr(depot, numero, { titre, auteur, branche, heures, draft = false, demandes = [], mergeable = true, etat = 'clean', checks = [], avis = [] }) {
    const tete = sha();
    const objet = {
      number: numero, title: titre, user: qui(auteur), html_url: gh(depot, `/pull/${numero}`),
      head: { ref: branche, sha: tete }, base: { ref: 'main' }, draft, created_at: il(heures),
      requested_reviewers: demandes.map(qui), requested_teams: [],
    };
    api[`${base(depot)}/pulls/${numero}`] = { ...objet, mergeable, mergeable_state: etat };
    api[`${base(depot)}/commits/${tete}/check-runs?per_page=100`] = {
      total_count: checks.length,
      check_runs: checks.map(([name, status, conclusion]) => ({ name, status, conclusion })),
    };
    api[`${base(depot)}/pulls/${numero}/reviews?per_page=100`] = avis.map(([login, state]) => ({ user: qui(login), state }));
    return objet;
  }

  api[`${base(JEU)}/pulls?state=open&per_page=50`] = [
    pr(JEU, 12, { titre: 'Ajoute l’événement de la taverne', auteur: 'demo-brams', branche: 'brams/evenement-taverne', heures: 74,
      mergeable: false, etat: 'dirty', demandes: ['demo-ayla'], checks: [['tests', 'completed', 'success']] }),
    pr(JEU, 14, { titre: 'Sprite du chevalier : couronne et cape', auteur: 'demo-cerise', branche: 'cerise/chevalier-couronne', heures: 26,
      demandes: ['demo-brams'], checks: [['tests', 'completed', 'failure'], ['Cloudflare Pages', 'completed', 'success']], avis: [['demo-dorn', 'APPROVED']] }),
    pr(JEU, 15, { titre: 'Grille de la salle 1', auteur: 'demo-dorn', branche: 'dorn/grille-salle-1', heures: 2, draft: true,
      mergeable: null, etat: 'unknown', checks: [['tests', 'in_progress', null]] }),
  ];
  api[`${base(DASH)}/pulls?state=open&per_page=50`] = [
    pr(DASH, 3, { titre: 'Widget des idées : trier par votes', auteur: 'demo-ayla', branche: 'ayla/widget-idees', heures: 122,
      checks: [['tests', 'completed', 'success']], avis: [['demo-brams', 'COMMENTED'], ['demo-brams', 'CHANGES_REQUESTED']] }),
  ];

  // --- Push et commits ---------------------------------------------------------------------
  function fil(depot, entrees) {
    const commitsMain = [];
    api[`${base(depot)}/activity?per_page=15`] = entrees.map(([type, acteur, branche, heures, message]) => {
      const after = type === 'branch_deletion' ? '0'.repeat(40) : sha();
      if (message) {
        const commit = { sha: after, html_url: gh(depot, `/commit/${after}`), commit: { message } };
        if (branche === 'main') commitsMain.push(commit);
        else api[`${base(depot)}/commits/${after}`] = commit;
      }
      return { activity_type: type, actor: qui(acteur), ref: `refs/heads/${branche}`, timestamp: il(heures), before: sha(), after };
    });
    api[`${base(depot)}/commits?per_page=10`] = commitsMain;
  }

  fil(JEU, [
    ['push', 'demo-cerise', 'cerise/chevalier-couronne', 0.7, 'Couronne : les 4 directions\n\nAvec la cape qui suit le corps.'],
    ['pr_merge', 'demo-ayla', 'main', 3, 'Le guide d’équipe en français (#11)'],
    ['branch_deletion', 'demo-ayla', 'ayla/guide-equipe', 3],
    ['branch_creation', 'demo-dorn', 'dorn/grille-salle-1', 5],
    ['push', 'demo-brams', 'brams/evenement-taverne', 26, 'Taverne : le dialogue du tavernier'],
    ['force_push', 'demo-dorn', 'dorn/essai-grille', 50, 'Essai de grille, refait'],
    ['push', 'demo-ayla', 'main', 54, 'Corrige une faute dans GAME_SPEC'],
  ]);
  fil(DASH, [
    ['push', 'demo-ayla', 'ayla/widget-idees', 6, 'Idées : trie par priorité puis par votes'],
    ['push', 'demo-brams', 'main', 96, 'Premier commit : README et .gitignore du dashboard'],
  ]);

  // --- Issues : idées et tâches ------------------------------------------------------------
  function issue(numero, { titre, auteur, labels = [], jalon = null, assignes = [], votes = 0, commentaires = 0, heures = 48 }) {
    return {
      number: numero, title: titre, user: qui(auteur), html_url: gh(JEU, `/issues/${numero}`),
      labels: labels.map((name) => ({ name })), milestone: jalon ? { title: jalon } : null,
      assignees: assignes.map(qui), reactions: { '+1': votes }, comments: commentaires, created_at: il(heures),
    };
  }

  api[`${base(JEU)}/issues?state=open&per_page=100`] = [
    issue(20, { titre: 'Une salle d’entraînement au combat', auteur: 'demo-brams', labels: ['idée', 'priorité: haute'], jalon: 'M3', assignes: ['demo-brams'], votes: 3, commentaires: 4 }),
    issue(21, { titre: 'Des références cachées un peu partout', auteur: 'demo-cerise', labels: ['idée', 'priorité: basse'], jalon: 'Parking', votes: 2 }),
    issue(22, { titre: 'Un butin lâché par les ennemis', auteur: 'demo-cerise', labels: ['idée', 'Priorité : Moyenne'], jalon: 'M4', votes: 4, commentaires: 1 }),
    issue(23, { titre: 'Montrer ce que fera le combo avant de valider', auteur: 'demo-ayla', labels: ['idée', 'priorité: haute'], jalon: 'M2 : Roll for it', votes: 4, commentaires: 6 }),
    issue(24, { titre: 'Titre avec du <b>HTML</b> : il doit rester du texte', auteur: 'demo-dorn', labels: ['idée'], heures: 1 }),
    issue(25, { titre: 'Une musique de taverne', auteur: 'demo-brams', labels: ['Idee'], votes: 1, heures: 10 }),
    issue(26, { titre: 'Un mode spectateur', auteur: 'demo-dorn', labels: ['idée', 'priorité: moyenne'], jalon: 'M2 : Roll for it', votes: 1 }),
    issue(30, { titre: 'Écrire la fiche de classe du rôdeur', auteur: 'demo-ayla', labels: ['combats'], jalon: 'D2', assignes: ['demo-ayla'] }),
    issue(31, { titre: 'Peindre le sprite du mage', auteur: 'demo-cerise', labels: ['pixel-art'], jalon: 'D4', assignes: ['demo-cerise'] }),
    issue(32, { titre: 'Remplir la feuille de mesure du combat papier', auteur: 'demo-dorn', labels: ['combats'], jalon: 'D2', assignes: ['demo-brams', 'demo-dorn'] }),
    issue(33, { titre: '[Retour] Le d20 est trop petit sur l’écran', auteur: 'demo-ayla', labels: ['retour'] }),
    issue(34, { titre: 'Choisir le nom du jeu', auteur: 'demo-dorn', jalon: 'D3' }),
    { ...issue(12, { titre: 'Ajoute l’événement de la taverne', auteur: 'demo-brams' }), pull_request: {} }, // une PR : ni tâche ni idée
  ];

  api[`${base(JEU)}/milestones?state=all&per_page=100`] = [
    ['D1', 0, 5], ['D2', 2, 1], ['D3', 1, 0], ['D4', 1, 0], ['M2 : Roll for it', 2, 0], ['M3', 1, 0], ['M4', 1, 0], ['Parking', 1, 0],
  ].map(([title, open_issues, closed_issues], i) => ({ title, open_issues, closed_issues, html_url: gh(JEU, `/milestone/${i + 1}`) }));

  return {
    api,
    fichiers: { 'GAME_SPEC.md': GAME_SPEC },
    local: {
      'equipe.json': [
        { github: 'demo-ayla', nom: 'Ayla' },
        { github: 'demo-brams', nom: 'Brams' },
        { github: 'demo-cerise', nom: 'Cerise' },
        { github: 'demo-dorn', nom: 'Dorn' },
      ],
    },
  };
}

// Le même format que le vrai GAME_SPEC.md, avec un peu d'avancée.
const GAME_SPEC = `# GAME_SPEC: Dungeon Co-op (working title)

## Now
- **Current stage:** D, the design stage (before M1). No game code yet (gate K: KICKOFF.md not signed off).
- **Current score of the focus aspect:** none yet.
- **Waiting on the owner's check (gate F):** nothing.

## Milestones
Each ends in something played on the live link (or, in stage D, on paper) and scored.

| # | Result you play | Check, and the score that passes | Status (date) |
|---|---|---|---|
| **D1** | **The paper fight**, both turn modes, with the test classes (\`PAPER_FIGHT_KIT.md\`) | the measure sheet filled in; "fun with four" 5/10 or more | done (16 Oct) |
| **D2** | **Each friend's class** on the template, the group picks the first four | four sheets within budget, each with a combo hook into another class | in progress (17 Oct) |
| **D3** | **The world sheet**, written by the team | one page the group agrees on; chapter 1's place, enemies and two bosses named | not started |
| **D4** | **One hero sprite** in Sprite Painter, scored | the owner's score of 7/10 or more (gate A brought forward) | not started |
| M1 | The table is set: repo and live link, four heroes on a grid room, host and join with a code, move in turn | two browsers join, move, leave; the heroes scored 7/10 or more | not started |
| M2 | Roll for it: turn order, d20 with stats and the exact chance of each result | a seeded fight replays in \`?test\`; the chances shown match 10,000 simulated rolls | not started |
| M3 | First playable: the four chosen classes, statuses, surfaces, shoves, a team move, revives | the four of you win with a combo; "fun with four" 5/10 or more | not started |
| M4 | The first run: 9 rooms, rewards, the wipe roll, levels that persist | three runs of the same chapter feel different | not started |

## Progress
`;
