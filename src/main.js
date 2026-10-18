// Le chef d'orchestre : il charge l'équipe, dessine chaque widget dans sa carte, tient l'en-tête à jour
// et, en direct, redessine les widgets concernés quand le Worker signale un changement.
//
// Un widget = un fichier dans src/widgets/. Il exporte :
//   sujets   : ce qui le rend périmé ('prs', 'commits', 'issues') ; [] s'il ne change jamais ;
//   afficher : async (ctx) => un nœud DOM. ctx = { moi, equipe, force, pourToi(items), relancer(ms),
//              redessiner(), issuesChangees() }.
// Si un widget plante, seule sa carte affiche l'erreur : les autres continuent.

import { config } from './config.js';
import * as github from './github.js';
import { brancher } from './direct.js';
import { installerTheme } from './theme.js';
import { installerMessagerie } from './messagerie.js';
import { installerProfil } from './profil.js';
import { session as sessionGithub } from './connexion.js';
import { creerSon } from './son.js';
import { el, lienExterne, nomDe, heure, tagDepot, fusionnerProfils, loginDuNom } from './outils.js';
import * as pullRequests from './widgets/pull-requests.js';
import * as commits from './widgets/commits.js';
import * as taches from './widgets/taches.js';
import * as avancee from './widgets/avancee.js';
import * as liens from './widgets/liens.js';
import * as idees from './widgets/idees.js';
import * as travail from './widgets/travail.js';

const WIDGETS = { 'pull-requests': pullRequests, commits, travail, taches, avancee, liens, idees };

const CLE_MOI = 'dungeoncoop:moi';
const parametres = new URLSearchParams(location.search);
const etat = {
  moi: parametres.get('moi') ?? lireStockage(CLE_MOI) ?? '',
  equipe: [], // equipe.json avec les pseudos (fusionnerProfils) : ce que lisent les widgets
  equipeFichier: [], // equipe.json tel quel
  profils: [], // les pseudos choisis, du Worker direct (GET /profils)
  session: null, // { nom, jeton } quand on est entré avec le mot de passe
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
    // Redessiner ce widget tout de suite (un choix d'affichage, une connexion).
    redessiner: () => rendre(id),
    // Ce widget vient d'écrire dans les issues (tableau de travail) : on relit tout ce qui en dépend.
    issuesChangees: () => issuesChangees(),
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

function issuesChangees() {
  github.oublier();
  for (const [id, widget] of Object.entries(WIDGETS)) {
    if (widget.sujets.includes('issues')) rendre(id, { force: true });
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

// Qui je suis, c'est un compte GitHub. Il vient, du plus sûr au moins sûr : de ?moi (les tests), de la connexion
// GitHub, du nom tapé à l'entrée (« Paul » → « PCrrfng » par equipe.json ou par les pseudos), ou de « Je suis ».
function changerMoi(login) {
  if (login === etat.moi) return;
  etat.moi = login;
  messagerie?.majMoi(etat.moi);
  etat.pourToi.clear();
  dessinerPourToi();
  profil?.dessiner();
  toutRendre();
}

function suivreGithub() {
  const login = sessionGithub.utilisateur?.login;
  if (login && !parametres.has('moi')) changerMoi(login);
  profil?.dessiner();
}

// Les pseudos ont changé (le mien depuis le menu, ou celui d'un autre, prévenu par le Worker) : toute la page suit.
function appliquerProfils(profils) {
  if (!Array.isArray(profils) || JSON.stringify(profils) === JSON.stringify(etat.profils)) return;
  etat.profils = profils;
  etat.equipe = fusionnerProfils(etat.equipeFichier, profils);
  messagerie?.majEquipe(etat.equipe);
  profil?.dessiner();
  dessinerPourToi();
  toutRendre();
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

let messagerie = null;
let profil = null;

async function demarrer() {
  installerTheme();
  document.getElementById('jouer').href = config.jeuEnLigne;   // l'adresse du jeu vient de config.js
  if (github.modeDemo) {
    document.getElementById('bandeau-demo').hidden = false;
    document.documentElement.dataset.mode = 'demo';
  }
  github.surInfos(dessinerEtat);
  document.getElementById('rafraichir').addEventListener('click', () => toutRendre({ force: true }));

  try {
    etat.equipeFichier = await github.local('equipe.json');
  } catch (erreur) {
    console.error('equipe.json :', erreur);
  }
  [etat.session, etat.profils] = await Promise.all([github.session(), github.profils()]);
  etat.equipe = fusionnerProfils(etat.equipeFichier, etat.profils);
  if (etat.session && !parametres.has('moi')) etat.moi = loginDuNom(etat.session.nom, etat.equipe) ?? etat.session.nom;

  // Le profil, en haut à droite. La connexion GitHub, d'où qu'elle vienne (le menu ou le tableau), dit qui je suis.
  profil = installerProfil({
    lire: () => ({ moi: etat.moi, equipe: etat.equipe, entree: etat.session }),
    choisirMoi(login) {
      ecrireStockage(CLE_MOI, login);
      changerMoi(login);
    },
    apresConnexion: () => rendre('travail'),
    apresPseudo: appliquerProfils,
  });
  profil.dessiner();
  document.addEventListener('dungeoncoop:github', suivreGithub);
  dessinerPourToi();
  dessinerEtat();

  // La messagerie : le laissez-passer vient de l'entrée. Sur ton ordi, sans porte, on peut en poser un à la main
  // dans localStorage (« dungeoncoop:laissez-passer ») pour essayer avec un Worker lancé en local.
  messagerie = installerMessagerie({
    equipe: etat.equipe,
    moi: etat.moi,
    jeton: etat.session?.jeton ?? (github.modeDemo ? null : lireStockage('dungeoncoop:laissez-passer')),
    nomSession: etat.session?.nom ?? null,
    disponible: github.modeDirect,
    demo: github.modeDemo,
    notifier,
    jouerSon: github.modeTest ? () => {} : creerSon(), // en test, les sons sont comptés, pas joués
    messagesDemo: github.modeDemo ? await github.messagesDemo() : [],
    avatarDe: (login) => (github.modeDemo ? null : `https://avatars.githubusercontent.com/${encodeURIComponent(login)}`),
  });
  window.__messagerie = messagerie; // pour les tests

  await toutRendre();

  if (github.modeDirect) {
    const liaison = brancher(github.adresseDirect, {
      surMessage(message) {
        if (message.type === 'maj') surMessageDirect(message);
        else if (message.type === 'profils') appliquerProfils(message.profils);
        else messagerie.recevoir(message);
      },
      surOuverture: () => messagerie.connecte(liaison.envoyer),
      surEtat(nouvel, { reconnexion } = {}) {
        etat.direct = nouvel;
        dessinerEtat();
        if (nouvel === 'hors-ligne') messagerie.deconnecte();
        if (nouvel === 'direct' && reconnexion) {
          toutRendre(); // on a pu rater des messages pendant la coupure
          github.profils().then(appliquerProfils);
        }
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
  window.__appliquerProfils = appliquerProfils;

  if (github.modeTest) {
    const { lancerTests } = await import('./test.js');
    await lancerTests({ etat, rendre, simuler: surMessageDirect });
  }
}

demarrer();
