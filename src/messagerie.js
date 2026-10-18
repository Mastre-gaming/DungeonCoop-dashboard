// La messagerie rapide : une bulle 💬 en bas à gauche, et un panneau par-dessus la page.
// Les messages passent par le Worker direct, sur la même connexion que le direct. On y entre avec le
// laissez-passer de l'écran d'entrée : le Worker le vérifie, et c'est lui qui signe chaque message du nom
// de son auteur. Dans le texte, #12 devient un lien vers l'issue ou la PR, et @nom prévient la personne.
// Un message des autres qu'on n'est pas en train de lire fait un petit son (🔔 dans le panneau pour le
// couper), et le titre de l'onglet compte les non-lus : « (3) DungeonCoop · Tableau de bord ».

import { urlGithub } from './config.js';
import { el, lienExterne, avatar, temps, normaliser, nomDe, loginDuNom } from './outils.js';

const CLE_VU = 'dungeoncoop:messages-vus';
const CLE_OUVERT = 'dungeoncoop:messagerie-ouverte';
const CLE_SON = 'dungeoncoop:son-messages';
const MOTIF = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)])|#(\d+)\b|@([\p{L}\p{N}_-]+)/gu;

const INFOS = {
  indisponible: 'La messagerie passe par le Worker direct, qui n’est pas encore branché.',
  'sans-jeton': 'Entre par l’écran du mot de passe pour lire et écrire ici.',
  connexion: 'Connexion…',
  coupee: 'Connexion perdue, je me reconnecte…',
};

export function installerMessagerie({ equipe, moi, jeton, nomSession, disponible, demo, notifier, jouerSon = () => {}, messagesDemo = [], avatarDe = () => null }) {
  const persistant = !demo; // en démo et en test, rien n'est gardé d'une ouverture à l'autre
  const etat = {
    messages: new Map(),
    statut: demo ? 'ouverte' : !disponible ? 'indisponible' : !jeton ? 'sans-jeton' : 'connexion',
    raison: '',
    moi,
    nom: nomSession ?? (demo ? nomDe(moi, equipe) : null),
    vu: persistant ? Number(lire(CLE_VU) ?? 0) : 0,
    envoyer: () => false,
    enAttente: new Map(), // ref → texte envoyé, en attendant la réponse du Worker
    compteur: 0,
    sonCoupe: persistant && lire(CLE_SON) === 'coupe',
    sons: 0, // les sons demandés depuis l'ouverture de la page (les tests les comptent)
  };
  const titreDeBase = document.title;

  // --- La bulle et le panneau --------------------------------------------------------------
  const compteurNonLus = el('span', { class: 'non-lus', hidden: true });
  const bulle = el('button', { type: 'button', class: 'bulle-messages', id: 'bulle-messages', 'aria-controls': 'messagerie', 'aria-expanded': 'false', title: 'Les messages de l’équipe' },
    el('span', { 'aria-hidden': 'true' }, '💬'), el('span', { class: 'libelle' }, 'Messages'), compteurNonLus);
  const statut = el('span', { class: 'statut' });
  const fil = el('ol', { class: 'fil-messages', 'aria-live': 'polite' });
  const info = el('p', { class: 'info' });
  const erreur = el('p', { class: 'erreur-envoi', role: 'alert', hidden: true });
  const zone = el('textarea', { rows: '2', maxlength: '500', 'aria-label': 'Ton message', placeholder: 'Écris à l’équipe… #12 pour une PR, @nom pour prévenir' });
  const envoi = el('button', { type: 'submit', class: 'bouton' }, 'Envoyer');
  const formulaire = el('form', { class: 'ecrire' }, zone, envoi);
  const boutonSon = el('button', { type: 'button', class: 'son', 'aria-label': 'Son des nouveaux messages', onclick: () => couperSon(!etat.sonCoupe) });
  const panneau = el('section', { class: 'messagerie', id: 'messagerie', 'aria-label': 'Les messages de l’équipe', hidden: true },
    el('header', {}, el('h2', {}, 'Messages'), statut, boutonSon,
      el('button', { type: 'button', class: 'fermer', 'aria-label': 'Fermer les messages', onclick: () => ouvrir(false) }, '✕')),
    fil, info, erreur, formulaire);
  document.body.append(bulle, panneau);

  bulle.addEventListener('click', () => ouvrir(panneau.hidden));
  panneau.addEventListener('keydown', (e) => e.key === 'Escape' && ouvrir(false));
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      formulaire.requestSubmit();
    }
  });
  formulaire.addEventListener('submit', (e) => {
    e.preventDefault();
    envoyer(zone.value);
  });
  // On lit la messagerie quand son panneau est ouvert, dans l'onglet affiché, dans la fenêtre au premier plan.
  // Sinon, un message des autres reste non lu et fait un son.
  const regarde = () => !panneau.hidden && !document.hidden && document.hasFocus();
  document.addEventListener('visibilitychange', () => {
    if (regarde()) marquerVus();
    dessinerNonLus();
  });
  window.addEventListener('focus', () => regarde() && marquerVus());

  function ouvrir(oui) {
    panneau.hidden = !oui;
    bulle.setAttribute('aria-expanded', String(oui));
    if (persistant) ecrire(CLE_OUVERT, oui ? '1' : '0');
    if (oui) {
      marquerVus();
      fil.scrollTop = fil.scrollHeight;
      zone.focus();
    }
  }

  // --- Qui est qui -------------------------------------------------------------------------
  // Un message est signé du nom tapé à l'entrée. On affiche le pseudo actuel de la personne, même sur ses vieux
  // messages : « Paul » devient « Mastre » partout dès qu'il change de pseudo (equipe : voir fusionnerProfils).
  const loginDe = (nom) => loginDuNom(nom, equipe);
  const nomAffiche = (nom) => {
    const login = loginDe(nom);
    return login ? nomDe(login, equipe) : nom;
  };
  function estMoi(nom) {
    const login = loginDe(nom);
    if (login && etat.moi && normaliser(login) === normaliser(etat.moi)) return true;
    const moiMemes = [etat.nom, etat.moi, nomDe(etat.moi, equipe)].filter(Boolean).map(normaliser);
    return moiMemes.includes(normaliser(nom));
  }
  const mentionneMoi = (texte) => [...texte.matchAll(MOTIF)].some((m) => m[3] && estMoi(m[3]));

  // --- Afficher ----------------------------------------------------------------------------
  function formater(texte) {
    const morceaux = [];
    texte.split('\n').forEach((ligne, i) => {
      if (i) morceaux.push(el('br'));
      let fin = 0;
      for (const m of ligne.matchAll(MOTIF)) {
        if (m.index > fin) morceaux.push(ligne.slice(fin, m.index));
        if (m[1]) morceaux.push(lienExterne(m[1], {}, m[1]));
        else if (m[2]) morceaux.push(lienExterne(`${urlGithub()}/issues/${m[2]}`, { class: 'ref', title: `L’issue ou la PR #${m[2]} du jeu` }, `#${m[2]}`));
        else morceaux.push(el('span', { class: `mention${estMoi(m[3]) ? ' moi' : ''}` }, `@${m[3]}`));
        fin = m.index + m[0].length;
      }
      if (fin < ligne.length) morceaux.push(ligne.slice(fin));
    });
    return morceaux;
  }

  function ligne(message) {
    const login = loginDe(message.auteur);
    const qui = { login: login ?? message.auteur, avatar_url: login ? avatarDe(login) : null };
    const classes = ['msg', estMoi(message.auteur) && 'mien', mentionneMoi(message.texte) && !estMoi(message.auteur) && 'me-mentionne'].filter(Boolean);
    return el('li', { class: classes.join(' '), dataset: { id: message.id } },
      avatar(qui, 24),
      el('div', { class: 'corps' },
        el('div', { class: 'qui' }, el('strong', { title: nomAffiche(message.auteur) !== message.auteur ? `Signé « ${message.auteur} » à l’entrée` : null }, nomAffiche(message.auteur)), ' ', temps(message.t)),
        el('p', {}, formater(message.texte))));
  }

  function dessinerFil() {
    const enBas = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 40;
    const tries = [...etat.messages.values()].sort((a, b) => a.id - b.id);
    fil.replaceChildren(...(tries.length ? tries.map(ligne) : [el('li', { class: 'vide-messages' }, 'Pas encore de message. Le premier, c’est toi ?')]));
    if (enBas) fil.scrollTop = fil.scrollHeight;
  }

  function nonLus() {
    return [...etat.messages.values()].filter((m) => m.id > etat.vu && !estMoi(m.auteur)).length;
  }

  function dessinerNonLus() {
    const n = nonLus();
    compteurNonLus.hidden = n === 0;
    compteurNonLus.textContent = n > 99 ? '99+' : String(n);
    bulle.setAttribute('aria-label', n ? `Messages : ${n} non lu${n > 1 ? 's' : ''}` : 'Messages');
    document.title = n ? `(${n > 99 ? '99+' : n}) ${titreDeBase}` : titreDeBase;
  }

  function dessinerSon() {
    boutonSon.textContent = etat.sonCoupe ? '🔕' : '🔔';
    boutonSon.setAttribute('aria-pressed', String(!etat.sonCoupe));
    boutonSon.title = etat.sonCoupe ? 'Son coupé : clique pour le remettre' : 'Un son quand un message arrive : clique pour le couper';
  }

  function couperSon(oui) {
    etat.sonCoupe = oui;
    if (persistant) ecrire(CLE_SON, oui ? 'coupe' : 'actif');
    dessinerSon();
    if (!oui) sonner(); // on entend tout de suite le son qu'on remet
  }

  function sonner() {
    if (etat.sonCoupe) return;
    etat.sons++;
    jouerSon();
  }

  function marquerVus() {
    const max = Math.max(etat.vu, ...[...etat.messages.keys()]);
    if (max > etat.vu) {
      etat.vu = max;
      if (persistant) ecrire(CLE_VU, String(max));
    }
    dessinerNonLus();
  }

  function dessinerStatut() {
    const ouverte = etat.statut === 'ouverte';
    statut.textContent = demo ? 'démo' : ouverte ? `● ${nomAffiche(etat.nom)}` : '';
    statut.className = `statut${ouverte ? ' en-direct' : ''}`;
    info.textContent = etat.statut === 'refusee' ? etat.raison : INFOS[etat.statut] ?? '';
    info.hidden = ouverte;
    zone.disabled = !ouverte;
    envoi.disabled = !ouverte;
  }

  function ajouter(message) {
    etat.messages.set(message.id, message);
    if (estMoi(message.auteur) && message.id > etat.vu) {
      etat.vu = message.id; // ses propres messages sont lus
      if (persistant) ecrire(CLE_VU, String(message.id));
    }
    if (regarde()) marquerVus();
  }

  // --- Envoyer -----------------------------------------------------------------------------
  function envoyer(texte) {
    const propre = texte.trim();
    if (!propre) return;
    erreur.hidden = true;
    if (demo) {
      ajouter({ id: Math.max(0, ...etat.messages.keys()) + 1, auteur: etat.nom, texte: propre, t: Date.now() });
      zone.value = '';
      dessinerFil();
      dessinerNonLus();
      return;
    }
    const ref = `m${++etat.compteur}`;
    if (!etat.envoyer({ type: 'envoyer', ref, texte: propre })) {
      montrerErreur('Pas connecté au direct : réessaie dans un instant.');
      return;
    }
    etat.enAttente.set(ref, zone.value);
    envoi.disabled = true;
  }

  function montrerErreur(texte) {
    erreur.textContent = texte;
    erreur.hidden = false;
  }

  // Le premier dessin.
  for (const message of messagesDemo) ajouter(message);
  dessinerFil();
  dessinerStatut();
  dessinerNonLus();
  dessinerSon();
  if (persistant && lire(CLE_OUVERT) === '1') ouvrir(true);

  // --- Ce que main.js appelle ----------------------------------------------------------------
  return {
    // La connexion au Worker est ouverte (ou rouverte) : on présente le laissez-passer.
    connecte(envoyerAuWorker) {
      etat.envoyer = envoyerAuWorker;
      if (!jeton) return;
      etat.statut = 'connexion';
      envoyerAuWorker({ type: 'jeton', jeton });
      dessinerStatut();
    },
    deconnecte() {
      if (etat.statut === 'ouverte' || etat.statut === 'connexion') etat.statut = 'coupee';
      dessinerStatut();
    },
    recevoir(message) {
      if (message.type === 'bienvenue') {
        etat.statut = 'ouverte';
        etat.nom = message.nom;
        for (const m of message.messages ?? []) ajouter(m);
      } else if (message.type === 'message') {
        const nouveau = !etat.messages.has(message.message.id);
        ajouter(message.message);
        const { auteur, texte } = message.message;
        if (nouveau && !estMoi(auteur) && !regarde()) {
          sonner();
          if (mentionneMoi(texte)) notifier([{ texte: `${nomAffiche(auteur)} te mentionne : « ${texte.length > 80 ? `${texte.slice(0, 79)}…` : texte} »` }]);
        }
      } else if (message.type === 'refuse') {
        etat.statut = 'refusee';
        etat.raison = message.raison;
      } else if (message.type === 'envoye') {
        const texte = etat.enAttente.get(message.ref);
        etat.enAttente.delete(message.ref);
        if (texte !== undefined && zone.value === texte) zone.value = '';
      } else if (message.type === 'erreur') {
        etat.enAttente.delete(message.ref);
        montrerErreur(message.erreur);
      }
      dessinerFil();
      dessinerStatut();
      dessinerNonLus();
    },
    majMoi(nouveauMoi) {
      etat.moi = nouveauMoi;
      if (demo) etat.nom = nomDe(nouveauMoi, equipe);
      dessinerFil();
      dessinerNonLus();
    },
    // Les pseudos ont changé : les noms du fil suivent.
    majEquipe(nouvelle) {
      equipe = nouvelle;
      dessinerFil();
      dessinerStatut();
      dessinerNonLus();
    },
    sons: () => etat.sons, // pour les tests
  };
}

function lire(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {}
}
