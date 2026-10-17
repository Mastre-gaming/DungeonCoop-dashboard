// Les réglages du dashboard : le seul fichier à changer si un repo ou une adresse change.

export const config = {
  organisation: 'Mastre-gaming',

  // Le repo du jeu : les idées, les tâches, l'avancée (GAME_SPEC.md) viennent de lui.
  jeu: 'DungeonCoop',

  // Les repos dont on suit les PR et les push. Le dashboard y est aussi : c'est là qu'on s'entraîne aux PR.
  depots: ['DungeonCoop', 'DungeonCoop-dashboard'],
  nomsCourts: { DungeonCoop: 'jeu', 'DungeonCoop-dashboard': 'dashboard' },

  // L'adresse du Worker « en direct » (dossier worker/), sans / à la fin.
  // Vide : la page lit GitHub elle-même, à jour à chaque ouverture mais sans mise à jour en direct.
  // Pour essayer une autre adresse sans toucher ce fichier : ?direct=http://localhost:8787
  direct: 'https://dungeoncoop-direct.mastredev.workers.dev',

  // Sans Worker, GitHub n'accepte que 60 appels par heure : on garde ses réponses ce nombre de minutes.
  cacheMinutes: 5,

  // Les jalons de GAME_SPEC.md, dans l'ordre. Les jalons GitHub portent les mêmes noms.
  jalons: ['D1', 'D2', 'D3', 'D4', 'M1', 'M2', 'M3', 'M4'],
  parking: 'Parking',

  // Les labels (la casse et les accents ne comptent pas).
  labelIdee: 'idée',
  prefixePriorite: 'priorité:', // priorité: haute / moyenne / basse

  // Le tableau de travail : une colonne par axe. Une tâche est rangée par son label « axe: … ».
  // Pour ajouter un axe : une ligne ici, et le même label dans le repo du jeu (Issues → Labels).
  prefixeAxe: 'axe:',
  axes: [
    { label: 'axe: combats', nom: 'Combats' },
    { label: 'axe: histoire', nom: 'Chapitres et histoire' },
    { label: 'axe: pixel art', nom: 'Pixel art' },
    { label: 'axe: salles', nom: 'Salles et carte' },
    { label: 'axe: menus', nom: 'Menus et écrans' },
    { label: 'axe: technique', nom: 'Technique' },
  ],
  // La colonne « Fait » montre ce qui a été fermé ces derniers jours ; les axes comptent tout.
  joursFait: 14,
};

export const depotJeu = `${config.organisation}/${config.jeu}`;
export const urlGithub = (depot = config.jeu) => `https://github.com/${config.organisation}/${depot}`;
