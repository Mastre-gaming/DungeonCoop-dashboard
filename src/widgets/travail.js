// Le tableau de travail : les tâches du jeu en colonnes, par axe (combats, histoire, pixel art…) ou par état
// (à faire, en cours, fait). Une carte = une issue du jeu ; une idée y entre quand quelqu'un la prend.
// Connecté avec GitHub, on modifie depuis ici : glisser une carte, « Je prends », « Fait », changer d'axe,
// l'urgence (élevée, moyenne, faible), abandonner une carte, créer une carte. Tout s'écrit dans GitHub (labels
// « axe: … » et « priorité: … », personnes assignées, issue fermée) : la page ne garde rien, et l'historique reste sur GitHub.
// Abandonner (le « supprimer » du tableau, demandé par Paul le 18 oct.) : la carte est fermée « non prévue », avec le
// label « abandonnée » ; elle sort du tableau et ne compte pas comme faite. On peut la rouvrir sur GitHub.

import { config, depotJeu, urlGithub } from '../config.js';
import { api, modeDemo } from '../github.js';
import { session, connexionDisponible, seConnecter, seDeconnecter, utilisateur, appel } from '../connexion.js';
import { el, lienExterne, avatar, nomDe, estIdee, aLeLabel, jalonDe, prioriteDe, normaliser } from '../outils.js';

export const sujets = ['issues'];

const CLE_VUE = 'dungeoncoop:vue-travail';
const ETATS = [
  { id: 'afaire', nom: 'À faire' },
  { id: 'encours', nom: 'En cours' },
  { id: 'fait', nom: 'Fait' },
];
const PRIORITES = ['haute', 'moyenne', 'basse'];
// L'urgence d'une carte : ce sont les labels « priorité: … » (le jeu et les idées les lisent aussi), dits autrement.
const URGENCE = { haute: 'élevée', moyenne: 'moyenne', basse: 'faible' };

let vue = lireVue();
let message = null; // { niveau, texte, t } : le résultat de la dernière action, affiché quelques secondes
const retouches = new Map(); // numéro → l'issue telle que GitHub l'a rendue après notre écriture

function lireVue() {
  try {
    return localStorage.getItem(CLE_VUE) === 'etat' ? 'etat' : 'axe';
  } catch {
    return 'axe';
  }
}

function changerVue(nouvelle, ctx) {
  vue = nouvelle;
  try {
    localStorage.setItem(CLE_VUE, vue);
  } catch {}
  ctx.redessiner();
}

const noms = (issue) => (issue.labels ?? []).map((l) => l.name ?? l);
export const estAbandonnee = (issue) => issue.state === 'closed' && (issue.state_reason === 'not_planned' || aLeLabel(issue, config.labelAbandon));
const estTache = (issue) => !issue.pull_request && (!estIdee(issue) || issue.assignees?.length) && !estAbandonnee(issue);
const etatDe = (issue) => (issue.state === 'closed' ? 'fait' : issue.assignees?.length ? 'encours' : 'afaire');
// Les axes : ceux de content/axes.json (le repo du jeu, le contrat avec le camp), sinon ceux de config.js.
// « anciens » : d'autres labels rangés dans le même axe.
let AXES = config.axes;
let axesLus = false;
async function chargerAxes() {
  if (axesLus || modeDemo || !config.axesDuJeu) return;
  axesLus = true;
  try {
    const r = await fetch(config.axesDuJeu, { cache: 'no-cache' });
    const contrat = r.ok ? await r.json() : null;
    const liste = (contrat?.axes ?? []).filter((a) => a?.label && a?.nom).map((a) => ({ label: a.label, nom: a.nom, anciens: a.anciens ?? [] }));
    if (liste.length) AXES = liste;
  } catch {} // le fichier ne se lit pas : on garde config.js
}
const labelsDe = (a) => [a.label, ...(a.anciens ?? [])];
const axeDe = (issue) => AXES.find((a) => labelsDe(a).some((l) => aLeLabel(issue, l)))?.label ?? '';
const logins = (issue) => (issue.assignees ?? []).map((a) => a.login);
const estAMoi = (issue, moi) => Boolean(moi) && logins(issue).some((l) => normaliser(l) === normaliser(moi));

function rang(issue) {
  const p = prioriteDe(issue);
  const i = p ? PRIORITES.indexOf(normaliser(p)) : -1;
  return i < 0 ? PRIORITES.length : i;
}

function trier(a, b) {
  const ordreEtat = { encours: 0, afaire: 1, fait: 2 };
  return ordreEtat[etatDe(a)] - ordreEtat[etatDe(b)] || rang(a) - rang(b) || new Date(a.created_at) - new Date(b.created_at);
}

// Ce que GitHub a déjà, plus nos dernières écritures (le cache du Worker peut avoir une seconde de retard).
function fusionner(issues) {
  const parNumero = new Map(issues.map((i) => [i.number, i]));
  for (const [numero, retouche] of retouches) {
    const lue = parNumero.get(numero);
    if (!lue || new Date(retouche.updated_at) >= new Date(lue.updated_at)) parNumero.set(numero, retouche);
    else retouches.delete(numero); // GitHub a plus récent : notre copie ne sert plus
  }
  return [...parNumero.values()];
}

export async function afficher(ctx) {
  await chargerAxes();
  const [lues, disponible, moi] = await Promise.all([
    api(`/repos/${depotJeu}/issues?state=all&per_page=100`, { force: ctx.force }),
    connexionDisponible(),
    utilisateur().catch((erreur) => {
      message = { niveau: 'grave', texte: erreur.message, t: Date.now() };
      return null;
    }),
  ]);
  const taches = fusionner(lues.filter((i) => !i.pull_request)).filter(estTache);
  const outils = { ctx, moi: moi?.login ?? null, taches };

  const colonnes = vue === 'axe' ? colonnesParAxe(taches) : colonnesParEtat(taches);
  return el('div', { class: 'travail', dataset: { vue, connecte: moi ? 'oui' : 'non' } },
    barre(ctx, moi, disponible),
    el('div', { class: 'colonnes' }, colonnes.map((c) => colonne(c, outils))),
    el('p', { class: 'pied' },
      lienExterne(`${urlGithub()}/issues`, {}, 'Toutes les issues'), ' · ',
      el('span', { class: 'muet' }, `Une carte = une issue du jeu, rangée par son label « ${config.prefixeAxe} … ». Une idée y entre quand quelqu’un la prend.`)));
}

// --- La barre du haut : la vue, la connexion, le dernier message ---------------------------------

function barre(ctx, moi, disponible) {
  const bouton = (id, texte) => el('button', {
    type: 'button', class: 'onglet', 'aria-pressed': String(vue === id), dataset: { vue: id },
    onclick: () => vue !== id && changerVue(id, ctx),
  }, texte);

  let compte;
  if (moi) {
    compte = el('div', { class: 'compte-github' },
      avatar(moi, 22), el('span', {}, 'Connecté : ', el('strong', {}, nomDe(moi.login, ctx.equipe))),
      el('button', { type: 'button', class: 'bouton discret petit', onclick: () => { seDeconnecter(); ctx.redessiner(); } }, 'Se déconnecter'));
  } else if (disponible) {
    compte = el('div', { class: 'compte-github' },
      el('button', { type: 'button', class: 'bouton', dataset: { action: 'connexion' }, onclick: () => { seConnecter(ctx.moi); if (modeDemo) ctx.redessiner(); } },
        modeDemo ? 'Se connecter (démo)' : 'Se connecter avec GitHub'),
      el('span', { class: 'muet' }, 'pour déplacer, prendre et créer des cartes'));
  } else {
    compte = el('div', { class: 'compte-github muet' }, 'Lecture seule : la connexion GitHub n’est pas encore branchée sur le Worker.');
  }

  const recent = message && Date.now() - message.t < 8000 ? message : null;
  const alerte = session.erreur ? { niveau: 'grave', texte: session.erreur } : recent;
  return el('div', {},
    el('div', { class: 'barre-travail' },
      el('div', { class: 'onglets', role: 'group', 'aria-label': 'Ranger les cartes' }, bouton('axe', 'Par axe'), bouton('etat', 'Par état')),
      compte),
    alerte ? el('p', { class: `message-travail ${alerte.niveau}`, role: alerte.niveau === 'grave' ? 'alert' : 'status' }, alerte.texte) : null);
}

// --- Les colonnes ---------------------------------------------------------------------------------

function colonnesParAxe(taches) {
  return [...AXES.map((a) => ({ id: a.label, nom: a.nom })), { id: '', nom: 'Sans axe' }].map((axe) => {
    const toutes = taches.filter((t) => axeDe(t) === axe.id);
    const ouvertes = toutes.filter((t) => t.state !== 'closed').sort(trier);
    return { type: 'axe', ...axe, cartes: ouvertes, faites: toutes.length - ouvertes.length, total: toutes.length };
  });
}

function colonnesParEtat(taches) {
  const limite = Date.now() - config.joursFait * 86400_000;
  return ETATS.map((etat) => {
    let cartes = taches.filter((t) => etatDe(t) === etat.id);
    let anciennes = 0;
    if (etat.id === 'fait') {
      const recentes = cartes.filter((t) => new Date(t.closed_at ?? 0) >= limite);
      anciennes = cartes.length - recentes.length;
      cartes = recentes.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    } else {
      cartes.sort(trier);
    }
    return { type: 'etat', ...etat, cartes, anciennes };
  });
}

function colonne(c, outils) {
  const { moi } = outils;
  const chiffres = c.type === 'axe'
    ? [el('span', { class: 'compte', title: 'ouvertes' }, c.cartes.length)]
    : [el('span', { class: 'compte' }, c.cartes.length)];
  const progression = c.type === 'axe' && c.total
    ? el('div', { class: 'progression-axe' },
      el('div', { class: 'barre', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((100 * c.faites) / c.total), 'aria-label': `${c.nom} : avancée` },
        el('div', { class: 'rempli', style: `width:${(100 * c.faites) / c.total}%` })),
      el('span', {}, `${c.faites}/${c.total} faites`))
    : null;

  const section = el('section', {
    class: `colonne colonne-travail${c.id === '' ? ' a-trier' : ''}`,
    dataset: { colonne: c.id, type: c.type },
    'aria-label': c.nom,
  },
  el('h3', {}, el('span', {}, c.nom), ...chiffres),
  progression,
  c.cartes.length ? el('ul', {}, c.cartes.map((t) => carte(t, outils))) : el('p', { class: 'muet' }, c.id === 'fait' ? 'Rien de fermé ces derniers jours.' : 'Rien ici.'),
  c.anciennes ? el('p', { class: 'astuce' }, `+ ${c.anciennes} fermée${c.anciennes > 1 ? 's' : ''} il y a plus de ${config.joursFait} jours`) : null,
  moi && c.id !== 'fait' ? ajout(c, outils) : null);

  if (moi) brancherGlisser(section, c, outils);
  return section;
}

// --- Une carte ------------------------------------------------------------------------------------

function carte(issue, outils) {
  const { ctx, moi } = outils;
  const jalon = jalonDe(issue);
  const priorite = prioriteDe(issue);
  const axe = AXES.find((a) => a.label === axeDe(issue));
  const etat = etatDe(issue);
  const meta = el('div', { class: 'meta' },
    `#${issue.number}`,
    jalon ? el('span', { class: 'tag tag-jalon' }, jalon) : null,
    priorite ? el('span', { class: `tag prio prio-${normaliser(priorite)}` }, `urgence ${URGENCE[normaliser(priorite)] ?? priorite}`) : null,
    vue === 'etat' && axe ? el('span', { class: 'tag' }, axe.nom) : null,
    vue === 'axe' && etat === 'encours' ? el('span', { class: 'tag tag-encours' }, 'en cours') : null,
    el('span', { class: 'qui' }, (issue.assignees ?? []).map((a) => el('span', { title: nomDe(a.login, ctx.equipe) }, avatar(a, 18)))));

  const li = el('li', { class: `tache carte-travail etat-${etat}`, dataset: { numero: issue.number, etat } },
    lienExterne(issue.html_url, { class: 'titre' }, issue.title), meta);
  if (!moi) return li;

  li.draggable = true;
  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(issue.number));
    e.dataTransfer.effectAllowed = 'move';
    li.classList.add('glisse');
  });
  li.addEventListener('dragend', () => li.classList.remove('glisse'));

  const ouverte = issue.state !== 'closed';
  const action = (nom, texte, corps, resume) => el('button', {
    type: 'button', class: 'bouton discret petit', dataset: { action: nom },
    onclick: () => modifier(outils, issue, corps(), resume),
  }, texte);
  const choixAxe = el('select', {
    class: 'choix-axe', 'aria-label': `Axe de #${issue.number}`, dataset: { action: 'axe' },
    onchange: (e) => modifier(outils, issue, { labels: labelsAvecAxe(issue, e.target.value) }, `rangée dans « ${nomAxe(e.target.value)} »`),
  }, el('option', { value: '', selected: !axe }, 'Sans axe'), AXES.map((a) => el('option', { value: a.label, selected: a === axe }, a.nom)));
  const prio = priorite ? normaliser(priorite) : '';
  const choixUrgence = el('select', {
    class: 'choix-urgence', 'aria-label': `Urgence de #${issue.number}`, dataset: { action: 'urgence' },
    onchange: (e) => modifier(outils, issue, { labels: labelsAvecPriorite(issue, e.target.value) }, e.target.value ? `urgence ${URGENCE[e.target.value]}` : 'sans urgence'),
  }, el('option', { value: '', selected: !prio }, 'Urgence ?'), PRIORITES.map((p) => el('option', { value: p, selected: p === prio }, `urgence ${URGENCE[p]}`)));
  const abandonner = el('button', {
    type: 'button', class: 'bouton discret petit abandonner', dataset: { action: 'abandonner' },
    onclick: () => {
      if (!window.confirm(`Abandonner #${issue.number} « ${issue.title} » ?\nElle sera fermée (non prévue) et sortira du tableau. On peut la rouvrir sur GitHub.`)) return;
      modifier(outils, issue, { state: 'closed', state_reason: 'not_planned', labels: [...noms(issue).filter((n) => normaliser(n) !== normaliser(config.labelAbandon)), config.labelAbandon] }, 'abandonnée (rouvrable sur GitHub)');
    },
  }, 'Abandonner');

  li.append(el('div', { class: 'actions-carte' },
    ouverte && !estAMoi(issue, moi) ? action('prendre', 'Je prends', () => ({ assignees: [...logins(issue), moi] }), 'prise') : null,
    ouverte && estAMoi(issue, moi) ? action('lacher', 'Je lâche', () => ({ assignees: logins(issue).filter((l) => normaliser(l) !== normaliser(moi)) }), 'lâchée') : null,
    ouverte ? action('fait', 'Fait ✓', () => ({ state: 'closed', state_reason: 'completed' }), 'faite') : action('rouvrir', 'Rouvrir', () => ({ state: 'open' }), 'rouverte'),
    choixAxe, ouverte ? choixUrgence : null, ouverte ? abandonner : null));
  return li;
}

const nomAxe = (label) => AXES.find((a) => a.label === label)?.nom ?? 'Sans axe';

function labelsAvecAxe(issue, label) {
  const autres = (issue.labels ?? []).map((l) => l.name ?? l).filter((n) => !AXES.some((a) => labelsDe(a).some((l) => normaliser(l) === normaliser(n))));
  return label ? [...autres, label] : autres;
}

// Les labels d'une carte avec une autre urgence (« priorité: haute » ; '' : sans urgence).
function labelsAvecPriorite(issue, p) {
  const prefixe = normaliser(config.prefixePriorite).replace(/[:\s]+$/, '');
  const autres = noms(issue).filter((n) => !normaliser(n).startsWith(prefixe));
  return p ? [...autres, `${config.prefixePriorite} ${p}`] : autres;
}

// Ce que veut dire « poser la carte dans cette colonne ».
function versColonne(issue, c, moi) {
  if (c.type === 'axe') return [{ labels: labelsAvecAxe(issue, c.id) }, `rangée dans « ${c.nom} »`];
  if (c.id === 'fait') return [{ state: 'closed', state_reason: 'completed' }, 'faite'];
  if (c.id === 'encours') return [{ state: 'open', assignees: logins(issue).length ? logins(issue) : [moi] }, 'en cours'];
  return [{ state: 'open', assignees: [] }, 'remise à faire'];
}

function brancherGlisser(section, c, outils) {
  section.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    section.classList.add('survol');
  });
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget)) section.classList.remove('survol');
  });
  section.addEventListener('drop', (e) => {
    e.preventDefault();
    section.classList.remove('survol');
    const issue = outils.taches.find((t) => t.number === Number(e.dataTransfer.getData('text/plain')));
    if (!issue) return;
    const deja = c.type === 'axe' ? axeDe(issue) === c.id : etatDe(issue) === c.id;
    if (deja) return;
    const [corps, resume] = versColonne(issue, c, outils.moi);
    modifier(outils, issue, corps, resume);
  });
}

// --- Créer une carte ------------------------------------------------------------------------------

function ajout(c, outils) {
  const champ = el('input', { type: 'text', class: 'champ-carte', placeholder: 'Titre de la tâche', 'aria-label': `Nouvelle carte dans ${c.nom}`, maxlength: 200 });
  const formulaire = el('form', {
    class: 'ajout-carte', hidden: true,
    onsubmit: (e) => {
      e.preventDefault();
      const titre = champ.value.trim();
      if (!titre) return;
      const corps = { title: titre, labels: c.type === 'axe' && c.id ? [c.id] : [], assignees: c.id === 'encours' ? [outils.moi] : [] };
      creer(outils, corps);
    },
  }, champ, el('div', { class: 'actions-carte' },
    el('button', { type: 'submit', class: 'bouton petit' }, 'Ajouter'),
    el('button', { type: 'button', class: 'bouton discret petit', onclick: () => { formulaire.hidden = true; ouvrir.hidden = false; } }, 'Annuler')));
  const ouvrir = el('button', {
    type: 'button', class: 'ajouter', dataset: { action: 'ajouter' },
    onclick: () => { ouvrir.hidden = true; formulaire.hidden = false; champ.focus(); },
  }, '+ Carte');
  return el('div', {}, ouvrir, formulaire);
}

// --- Écrire dans GitHub ---------------------------------------------------------------------------

async function modifier(outils, issue, corps, resume) {
  document.querySelectorAll(`.carte-travail[data-numero="${issue.number}"]`).forEach((n) => n.setAttribute('aria-busy', 'true'));
  await ecrire(outils, () => appel('PATCH', `/repos/${depotJeu}/issues/${issue.number}`, corps), (n) => `#${n.number} ${resume}.`);
}

async function creer(outils, corps) {
  await ecrire(outils, () => appel('POST', `/repos/${depotJeu}/issues`, corps), (n) => `#${n.number} créée.`);
}

async function ecrire({ ctx }, faire, resume) {
  session.erreur = null;
  try {
    const nouvelle = await faire();
    retouches.set(nouvelle.number, nouvelle);
    message = { niveau: 'bon', texte: `✓ ${resume(nouvelle)}`, t: Date.now() };
  } catch (erreur) {
    message = { niveau: 'grave', texte: erreur.message, t: Date.now() };
  }
  ctx.issuesChangees();
}
