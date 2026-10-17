// Le chef d'orchestre : il charge l'équipe, dessine chaque widget dans sa carte, tient l'en-tête à jour
// et, en direct, redessine les widgets concernés quand le Worker signale un changement.
//
// Un widget = un fichier dans src/widgets/. Il exporte :
//   sujets   : ce qui le rend périmé ('prs', 'commits', 'issues') ; [] s'il ne change jamais ;
//   afficher : async (ctx) => un nœud DOM. ctx = { moi, equipe, force, pourToi(items), relancer(ms) }.
// Si un widget plante, seule sa carte affiche l'erreur : les autres continuent.

import { config } from './config.js';
import * as github from './github.js';
import { brancher } from './direct.js';
import { el, lienExterne, nomDe, heure, tagDepot } from './outils.js';
import * as pullRequests from './widgets/pull-requests.js';
import * as commits from './widgets/commits.js';
import * as taches from './widgets/taches.js';
import * as avancee from './widgets/avancee.js';
import * as liens from './widgets/liens.js';
import * as idees from './widgets/idees.js';

const WIDGETS = { 'pull-requests': pullRequests, commits, taches, avancee, liens, idees };

const CLE_MOI = 'dungeoncoop:moi';
const parametres = new URLSearchParams(location.search);
const etat = {
  moi: parametres.get('moi') ?? lireStockage(CLE_MOI) ?? '',
  equipe: [],
  pourToi: new Map(), // id du widget → ce qui attend « moi » dans ce widget
  derniereMaj: null,
  direct: github.modeDirect ? 'connexion' : null,
};

function lireStockage(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {}
}

// --- Dessiner un widget ----------------------------------------------------------------------

const enCours = new Map();
const aRefaire = new Map();
const relances = new Map();

function rendre(id, { force = false } = {}) {
  if (enCours.has(id)) {
    aRefaire.set(id, force || aRefaire.get(id) === true);
    return enCours.get(id);
  }
  const promesse = dessiner(id, force).finally(() => {
    enCours.delete(id);
    if (aRefaire.has(id)) {
      const forcer = aRefaire.get(id);
      aRefaire.delete(id);
      rendre(id, { force: forcer });
    }
  });
  enCours.set(id, promesse);
  return promesse;
}

async function dessiner(id, force) {
  const carte = document.getElementById(id);
  const zone = carte.querySelector('.contenu');
  carte.setAttribute('aria-busy', 'true');
  const ctx = {
    moi: etat.moi,
    equipe: etat.equipe,
    force,
    pourToi(items) {
      etat.pourToi.set(id, items);
      dessinerPourToi();
    },
    // Redessiner ce widget un peu plus tard (GitHub calcule encore un conflit, par exemple). 3 fois de suite au plus.
    relancer(ms) {
      const fois = relances.get(id) ?? 0;
      if (fois >= 3 || github.modeDemo) return;
      relances.set(id, fois + 1);
      setTimeout(() => {
        github.oublier();
        rendre(id, { force: true });
      }, ms);
    },
  };
  try {
    const noeud = await WIDGETS[id].afficher(ctx);
    zone.replaceChildren(noeud);
    carte.dataset.etat = 'ok';
  } catch (erreur) {
    console.error(`Widget ${id} :`, erreur);
    zone.replaceChildren(
      el('div', { class: 'erreur', role: 'alert' },
        el('p', {}, el('strong', {}, 'Ce widget n’a pas pu se charger. '), erreur.message),
        el('button', { type: 'button', class: 'bouton discret', onclick: () => rendre(id, { force: true }) }, 'Réessayer')));
    carte.dataset.etat = 'erreur';
  } finally {
    carte.removeAttribute('aria-busy');
    carte.dataset.rendus = String(Number(carte.dataset.rendus ?? 0) + 1);
  }
}

async function toutRendre({ force = false } = {}) {
  if (force) github.oublier();
  relances.clear();
  await Promise.all(Object.keys(WIDGETS).map((id) => rendre(id, { force })));
  etat.derniereMaj = Date.now();
  dessinerEtat();
}

// --- « Pour toi » -----------------------------------------------------------------------------

function dessinerPourToi() {
  const zone = document.getElementById('pour-toi');
  if (!etat.moi) {
    zone.replaceChildren(el('p', { class: 'invite' }, 'Choisis qui tu es en haut à droite : la page te montrera ce qui t’attend.'));
    return;
  }
  const gravite = { grave: 0, attention: 1, bon: 2, neutre: 3 };
  const items = [...etat.pourToi.values()].flat().sort((a, b) => (gravite[a.niveau] ?? 3) - (gravite[b.niveau] ?? 3));
  const titre = el('h2', {}, `Pour toi, ${nomDe(etat.moi, etat.equipe)}`);
  if (!items.length) {
    zone.replaceChildren(titre, el('p', { class: 'rien' }, '✓ Rien ne t’attend pour l’instant. ', el('a', { href: '#taches' }, 'Une tâche à prendre ?')));
    return;
  }
  zone.replaceChildren(titre, el('ul', {}, items.map((item) =>
    el('li', { class: `item ${item.niveau ?? 'neutre'}` },
      item.lien ? lienExterne(item.lien, {}, item.texte) : item.texte))));
}

// --- L'en-tête : qui je suis, l'état des données ----------------------------------------------

function dessinerChoixMoi() {
  const choix = document.getElementById('moi');
  const options = [el('option', { value: '' }, '—')];
  const logins = etat.equipe.map((m) => m.github);
  if (etat.moi && !logins.includes(etat.moi)) logins.push(etat.moi);
  for (const login of logins) options.push(el('option', { value: login, selected: login === etat.moi }, nomDe(login, etat.equipe)));
  choix.replaceChildren(...options);
  choix.onchange = () => {
    etat.moi = choix.value;
    ecrireStockage(CLE_MOI, etat.moi);
    etat.pourToi.clear();
    dessinerPourToi();
    toutRendre();
  };
}

function dessinerEtat() {
  const zone = document.getElementById('etat');
  const { infos } = github;
  let classe = 'github';
  let texte;
  if (github.modeDemo) {
    classe = 'demo';
    texte = 'Démo';
  } else if (github.modeDirect && etat.direct === 'direct' && !infos.secours) {
    classe = 'direct';
    texte = 'En direct';
  } else if (github.modeDirect && !infos.secours) {
    classe = 'connexion';
    texte = 'Connexion au direct…';
  } else {
    texte = etat.derniereMaj ? `À jour à ${heure(etat.derniereMaj)}` : 'Chargement…';
  }
  const details = [];
  if (infos.secours) details.push('Worker injoignable : lecture directe de GitHub');
  if (infos.limiteAtteinte) details.push(`limite GitHub atteinte, retour à ${heure(infos.reset)}`);
  else if (infos.restants != null && !github.modeDirect) details.push(`${infos.restants}/60 appels GitHub restants cette heure`);
  zone.className = `etat ${classe}`;
  zone.replaceChildren(el('span', { class: 'point', 'aria-hidden': 'true' }), el('span', {}, texte));
  zone.title = details.join(' · ') || (classe === 'direct' ? 'La page se met à jour toute seule.' : 'Les données viennent de GitHub.');
  document.getElementById('limite').textContent = details.join(' · ');
}

// --- Les notifications du direct --------------------------------------------------------------

function notifier(messages) {
  const pile = document.getElementById('notifs');
  for (const message of messages) {
    const contenu = [message.depot ? tagDepot(message.depot) : null, el('span', {}, message.texte)];
    const notif = message.lien ? lienExterne(message.lien, { class: 'notif' }, contenu) : el('div', { class: 'notif' }, contenu);
    pile.append(notif);
    setTimeout(() => notif.remove(), 9000);
  }
  while (pile.children.length > 4) pile.firstElementChild.remove();
}

const enAttente = new Set();
let minuterieDirect = null;

function surMessageDirect(message) {
  github.oublier();
  for (const sujet of message.sujets ?? []) enAttente.add(sujet);
  if (message.messages?.length) notifier(message.messages);
  clearTimeout(minuterieDirect);
  minuterieDirect = setTimeout(() => {
    const sujets = [...enAttente];
    enAttente.clear();
    for (const [id, widget] of Object.entries(WIDGETS)) {
      if (widget.sujets.some((s) => sujets.includes(s))) rendre(id);
    }
    etat.derniereMaj = Date.now();
  }, 300);
}

// --- Démarrage -------------------------------------------------------------------------------

async function demarrer() {
  if (github.modeDemo) {
    document.getElementById('bandeau-demo').hidden = false;
    document.documentElement.dataset.mode = 'demo';
  }
  github.surInfos(dessinerEtat);
  document.getElementById('rafraichir').addEventListener('click', () => toutRendre({ force: true }));

  try {
    etat.equipe = await github.local('equipe.json');
  } catch (erreur) {
    console.error('equipe.json :', erreur);
  }
  dessinerChoixMoi();
  dessinerPourToi();
  dessinerEtat();
  await toutRendre();

  if (github.modeDirect) {
    brancher(github.adresseDirect, {
      surMessage: surMessageDirect,
      surEtat(nouvel, { reconnexion } = {}) {
        etat.direct = nouvel;
        dessinerEtat();
        if (nouvel === 'direct' && reconnexion) toutRendre(); // on a pu rater des messages pendant la coupure
      },
    });
    // Les webhooks ne disent rien des votes 👍 : un tour complet toutes les 3 minutes les rattrape.
    setInterval(() => document.visibilityState === 'visible' && toutRendre(), 3 * 60_000);
  } else if (!github.modeDemo) {
    // Sans direct : quand on revient sur l'onglet, on relit si les données ont plus de config.cacheMinutes.
    document.addEventListener('visibilitychange', () => {
      const vieux = Date.now() - (etat.derniereMaj ?? 0) > config.cacheMinutes * 60_000;
      if (document.visibilityState === 'visible' && vieux) toutRendre();
    });
  }

  // Pour les tests : simuler un message du Worker sans Worker.
  window.__simulerDirect = surMessageDirect;

  if (github.modeTest) {
    const { lancerTests } = await import('./test.js');
    await lancerTests({ etat, rendre, simuler: surMessageDirect });
  }
}

demarrer();
