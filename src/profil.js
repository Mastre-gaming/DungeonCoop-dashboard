// Le profil du dev, en haut à droite : son icône (l'avatar GitHub, en attendant le portrait de son héros), son
// pseudo, et un petit menu avec la connexion GitHub et le pseudo à changer. Le pseudo vit dans le Worker direct,
// sous le compte GitHub (worker/src/profils.js) : toute la page l'affiche à la place du nom d'equipe.json, et le
// camp peut le lire aussi. Pour le changer, il faut être connecté à GitHub : c'est ce qui prouve qui on est.

import * as github from './github.js';
import { session, connexionDisponible, seConnecter, seDeconnecter } from './connexion.js';
import { el, avatar, nomDe, normaliser } from './outils.js';

// lire() → { moi, equipe, entree } (entree : la session de la porte, ou null) ;
// choisirMoi(login) : « Je suis », sans porte ni GitHub ; apresConnexion() : GitHub branché ou coupé depuis le menu ;
// apresPseudo(profils) : le pseudo a changé, avec la liste à jour.
export function installerProfil({ lire, choisirMoi, apresConnexion, apresPseudo }) {
  const zone = document.getElementById('profil');
  const bouton = el('button', { type: 'button', class: 'profil-bouton', id: 'bouton-profil', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'menu-profil' });
  const menu = el('div', { class: 'profil-menu', id: 'menu-profil', role: 'dialog', 'aria-label': 'Ton profil de dev', hidden: true });
  zone.replaceChildren(bouton, menu);
  let disponible = false;
  let message = null; // { niveau: 'ok' | 'erreur', texte } : le résultat du dernier enregistrement

  connexionDisponible().then((oui) => {
    disponible = oui;
    dessiner();
  });

  bouton.addEventListener('click', () => ouvrir(menu.hidden));
  // Un clic ailleurs ferme le menu. composedPath() est pris au moment du clic : un bouton du menu que son propre
  // clic vient de redessiner (connexion, déconnexion) compte encore comme « dans le menu ».
  document.addEventListener('click', (e) => !menu.hidden && !e.composedPath().includes(zone) && ouvrir(false));
  zone.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || menu.hidden) return;
    ouvrir(false);
    bouton.focus();
  });

  function ouvrir(oui) {
    menu.hidden = !oui;
    bouton.setAttribute('aria-expanded', String(oui));
    if (!oui) return;
    message = null;
    dessiner();
    placer();
    menu.querySelector('input:not([disabled])')?.focus();
  }

  // Le menu s'aligne sur le bord droit du bouton ; sur un écran étroit, le bouton passe à gauche : on le décale
  // pour qu'il reste dans l'écran, à 16 px du bord.
  function placer() {
    menu.style.right = '';
    const gauche = menu.getBoundingClientRect().left;
    if (gauche < 16) menu.style.right = `${gauche - 16}px`;
  }

  // Le bouton est toujours redessiné ; le menu seulement s'il est fermé, ou si on le demande (pour ne pas
  // effacer un pseudo en train d'être tapé quand un autre change le sien).
  function dessiner({ menuAussi = false } = {}) {
    const { moi, equipe, entree } = lire();
    const compte = session.utilisateur;
    const membre = equipe.find((m) => normaliser(m.github) === normaliser(moi));
    const icone = {
      login: membre?.github ?? (moi || '?'),
      avatar_url: compte?.avatar_url ?? (membre && !github.modeDemo ? `https://avatars.githubusercontent.com/${encodeURIComponent(membre.github)}` : null),
    };
    bouton.replaceChildren(avatar(icone, 26), el('span', { class: 'nom' }, moi ? nomDe(moi, equipe) : 'Qui es-tu ?'), el('span', { class: 'fleche', 'aria-hidden': 'true' }, '▾'));
    bouton.title = 'Ton profil : pseudo et connexion GitHub';
    if (!menu.hidden && !menuAussi) return;
    const parties = [
      el('div', { class: 'profil-tete' }, avatar(icone, 40),
        el('div', {}, el('strong', {}, moi ? nomDe(moi, equipe) : 'Qui es-tu ?'), membre ? el('span', { class: 'muet' }, `@${membre.github}`) : null)),
      partiePseudo(compte, equipe),
      partieGithub(compte, moi),
      !entree && !compte ? partieJeSuis(moi, equipe) : null,
      entree ? el('a', { class: 'quitter', href: '/deconnexion' }, 'Quitter le dashboard') : null,
    ];
    menu.replaceChildren(...parties.filter(Boolean));
  }

  function partiePseudo(compte, equipe) {
    const membre = compte && equipe.find((m) => normaliser(m.github) === normaliser(compte.login));
    const actuel = membre ? nomDe(membre.github, equipe) : '';
    const nomEquipe = membre ? (membre.nomEquipe ?? membre.nom) || membre.github : '';
    const champ = el('input', { type: 'text', id: 'champ-pseudo', name: 'pseudo', maxlength: '40', autocomplete: 'nickname', spellcheck: 'false', value: actuel, disabled: !membre, placeholder: nomEquipe });
    const envoi = el('button', { type: 'submit', class: 'bouton', disabled: !membre }, 'Enregistrer');
    const aide = !compte ? 'Connecte-toi avec GitHub pour le changer : c’est ce qui prouve que c’est toi.'
      : !membre ? `@${compte.login} n’est pas dans equipe.json : demande à l’équipe de t’y ajouter.`
      : `Ton nom pour toute l’équipe. Vide : « ${nomEquipe} », le nom d’equipe.json.`;
    const formulaire = el('form', { class: 'profil-pseudo' },
      el('label', { for: 'champ-pseudo' }, 'Ton pseudo de dev'),
      el('div', { class: 'ligne' }, champ, envoi),
      el('p', { class: 'aide' }, aide),
      message ? el('p', { class: `resultat ${message.niveau}`, role: message.niveau === 'erreur' ? 'alert' : 'status' }, message.texte) : null);
    formulaire.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nom = champ.value.trim().replace(/\s+/g, ' ');
      if (nom === actuel) return ouvrir(false);
      envoi.disabled = true;
      try {
        const profils = await github.changerPseudo(nom, session.jeton, compte.login);
        message = { niveau: 'ok', texte: nom ? `C’est fait : tu es « ${nom} » pour toute l’équipe.` : `C’est fait : tu reprends « ${nomEquipe} ».` };
        apresPseudo(profils);
      } catch (erreur) {
        message = { niveau: 'erreur', texte: erreur.message };
      }
      dessiner({ menuAussi: true });
      menu.querySelector('#champ-pseudo')?.focus();
    });
    return formulaire;
  }

  function partieGithub(compte, moi) {
    let contenu;
    if (compte) {
      contenu = [el('span', {}, 'Connecté : ', el('strong', {}, `@${compte.login}`)),
        el('button', { type: 'button', class: 'bouton discret petit', dataset: { action: 'deconnexion-github' }, onclick: () => { seDeconnecter(); apresConnexion(); dessiner({ menuAussi: true }); } }, 'Se déconnecter')];
    } else if (disponible) {
      contenu = [el('button', { type: 'button', class: 'bouton', dataset: { action: 'connexion-github' }, onclick: () => { seConnecter(moi); apresConnexion(); dessiner({ menuAussi: true }); } },
        github.modeDemo ? 'Se connecter (démo)' : 'Se connecter avec GitHub'),
        el('span', { class: 'muet' }, 'pour changer ton pseudo et modifier le tableau de travail')];
    } else {
      contenu = [el('span', { class: 'muet' }, 'La connexion GitHub n’est pas encore branchée sur le Worker.')];
    }
    return el('div', { class: 'profil-github' }, el('h3', {}, 'GitHub'), el('div', { class: 'ligne' }, contenu));
  }

  // Sans porte ni GitHub (sur ton ordi, ou en démo) : on dit qui on est à la main.
  function partieJeSuis(moi, equipe) {
    const logins = equipe.map((m) => m.github);
    if (moi && !logins.includes(moi)) logins.push(moi);
    const choix = el('select', { id: 'moi' }, el('option', { value: '' }, '—'),
      logins.map((login) => el('option', { value: login, selected: login === moi }, nomDe(login, equipe))));
    choix.addEventListener('change', () => choisirMoi(choix.value));
    return el('label', { class: 'profil-moi' }, 'Je suis ', choix);
  }

  return { dessiner, ouvrir };
}
