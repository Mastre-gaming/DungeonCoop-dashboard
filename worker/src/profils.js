// Les profils des devs : le pseudo que chacun choisit, rangé sous son compte GitHub. L'identité, c'est le
// compte GitHub ; le pseudo n'est qu'un nom affiché, à la place du nom d'equipe.json, par le dashboard et le camp.
//
//   GET /profils   [{ github, nom, t }] pour tout le monde (rien de secret : equipe.json est public aussi)
//   PUT /profil    { nom } avec « Authorization: Bearer <token GitHub> », celui de la connexion du tableau.
//                  Le Worker demande à GitHub à qui est ce token : chacun ne change que son propre pseudo, et
//                  seulement s'il est dans equipe.json. Un nom vide rend le nom d'equipe.json.
//
// Ce fichier ne dépend de rien de Cloudflare : testé avec Node (test/profils.test.js).

import { nomValide } from './session.js';

const norm = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Un pseudo ne doit pas faire prendre quelqu'un pour un autre : ni le pseudo, ni le nom d'equipe.json,
// ni le compte GitHub d'un autre membre (sans tenir compte des majuscules ni des accents).
export function pseudoPris(nom, login, equipe, profils) {
  const n = norm(nom);
  const autre = (github) => norm(github) !== norm(login);
  return equipe.some((m) => autre(m.github) && (norm(m.github) === n || norm(m.nom) === n))
    || profils.some((p) => autre(p.github) && norm(p.nom) === n);
}

// Renvoie { status, profil } ou { status, erreur }. quiEst(token) → le login GitHub, ou null si le token est refusé.
export async function changerProfil({ token, corps, equipe, profils, quiEst, enregistrer, effacer, maintenant = Date.now() }) {
  if (!token) return { status: 401, erreur: 'Connecte-toi avec GitHub pour changer ton pseudo.' };
  if (!equipe) return { status: 503, erreur: 'Le Worker n’arrive pas à lire equipe.json : réessaie dans un instant.' };
  let login;
  try {
    login = await quiEst(token);
  } catch {
    return { status: 502, erreur: 'GitHub ne répond pas : réessaie dans un instant.' };
  }
  if (!login) return { status: 401, erreur: 'La connexion GitHub a expiré : reconnecte-toi.' };
  const membre = equipe.find((m) => norm(m.github) === norm(login));
  if (!membre) return { status: 403, erreur: `@${login} n’est pas dans equipe.json : demande à l’équipe de t’y ajouter.` };

  const nom = String(corps?.nom ?? '').trim().replace(/\s+/g, ' ');
  if (!nom) {
    effacer(membre.github);
    return { status: 200, profil: null };
  }
  if (!nomValide(nom)) return { status: 400, erreur: 'Ton pseudo : 1 à 40 lettres, chiffres, espaces, points ou tirets.' };
  if (pseudoPris(nom, login, equipe, profils)) return { status: 409, erreur: `« ${nom} » est déjà le nom de quelqu’un d’autre dans l’équipe.` };
  const profil = { github: membre.github, nom, t: maintenant };
  enregistrer(profil);
  return { status: 200, profil };
}
