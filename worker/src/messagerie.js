// La messagerie rapide de l'équipe, sans rien de Cloudflare dedans (testable avec Node).
// Le Durable Object lui passe chaque message reçu d'une page, avec l'état de cette page (« attachement »),
// et fait ce qu'elle répond : quoi envoyer à cette page, quoi diffuser à toutes les pages entrées.
//
// Ce que les pages envoient :
//   { type: 'jeton', jeton }          le laissez-passer de l'entrée (porte/) ; le nom vient de lui, pas de la page
//   { type: 'envoyer', ref, texte }   un message
// Ce que les pages reçoivent :
//   { type: 'bienvenue', nom, messages }     les 100 derniers messages
//   { type: 'refuse', raison }               laissez-passer refusé, ou messagerie pas réglée
//   { type: 'message', message }             un nouveau message : { id, auteur, texte, t }
//   { type: 'envoye', ref, id } / { type: 'erreur', ref, erreur }

import { lireJeton } from './session.js';

export const LONGUEUR_MAX = 500;
const HISTORIQUE = 100;

// Le texte d'un message : sans espaces autour, pas plus de deux lignes vides d'affilée, 500 caractères au plus.
export function nettoyerTexte(texte) {
  if (typeof texte !== 'string') return null;
  const propre = texte.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return propre && propre.length <= LONGUEUR_MAX ? propre : null;
}

// Pas plus de `max` messages par personne en `fenetre` millisecondes.
export class Limiteur {
  constructor({ max = 8, fenetre = 20_000, maintenant = () => Date.now() } = {}) {
    Object.assign(this, { max, fenetre, maintenant, traces: new Map() });
  }

  autorise(cle) {
    const t = this.maintenant();
    const recents = (this.traces.get(cle) ?? []).filter((x) => t - x < this.fenetre);
    const ok = recents.length < this.max;
    if (ok) recents.push(t);
    this.traces.set(cle, recents);
    return ok;
  }
}

export class Messagerie {
  // stockage : { ajouter({ auteur, texte, t }) → id, derniers(n) → [{ id, auteur, texte, t }] }
  constructor({ secret, stockage, maintenant = () => Date.now(), limiteur = new Limiteur() }) {
    Object.assign(this, { secret, stockage, maintenant, limiteur });
  }

  async traiter(recu, attachement = {}) {
    let demande;
    try {
      demande = JSON.parse(recu);
    } catch {
      return { attachement, envoyer: [], diffuser: [] };
    }

    if (demande.type === 'jeton') {
      if (!this.secret) return reponse(attachement, { type: 'refuse', raison: 'La messagerie n’est pas réglée : le secret MOT_DE_PASSE manque au Worker direct.' });
      const session = await lireJeton(this.secret, demande.jeton, { maintenant: this.maintenant() });
      if (!session) return reponse({ ...attachement, equipe: false }, { type: 'refuse', raison: 'Laissez-passer refusé : reconnecte-toi (le mot de passe a peut-être changé).' });
      return reponse({ ...attachement, equipe: true, nom: session.nom }, { type: 'bienvenue', nom: session.nom, messages: this.stockage.derniers(HISTORIQUE) });
    }

    if (demande.type === 'envoyer') {
      const ref = demande.ref ?? null;
      if (!attachement.equipe) return reponse(attachement, { type: 'erreur', ref, erreur: 'Il faut être entré avec le mot de passe pour écrire.' });
      const texte = nettoyerTexte(demande.texte);
      if (!texte) return reponse(attachement, { type: 'erreur', ref, erreur: `Un message fait de 1 à ${LONGUEUR_MAX} caractères.` });
      if (!this.limiteur.autorise(attachement.nom)) return reponse(attachement, { type: 'erreur', ref, erreur: 'Doucement : attends quelques secondes avant le prochain message.' });
      const message = { auteur: attachement.nom, texte, t: this.maintenant() };
      message.id = this.stockage.ajouter(message);
      return { attachement, envoyer: [{ type: 'envoye', ref, id: message.id }], diffuser: [{ type: 'message', message }] };
    }

    return { attachement, envoyer: [], diffuser: [] };
  }
}

function reponse(attachement, message) {
  return { attachement, envoyer: [message], diffuser: [] };
}
