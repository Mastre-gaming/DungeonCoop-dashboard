// Les liens utiles : une grille de boutons, lue dans liens.json.
// Tout le monde peut l'enrichir depuis le site de GitHub, sans code. Un lien encore vide s'affiche
// « à ajouter », avec de quoi le remplir.

import { config } from '../config.js';
import { local } from '../github.js';
import { el, lienExterne, vide } from '../outils.js';

export const sujets = [];

const EDITER = `https://github.com/${config.organisation}/DungeonCoop-dashboard/edit/main/liens.json`;

export async function afficher() {
  const liens = await local('liens.json');
  if (!liens.length) return vide('Aucun lien pour l’instant.', lienExterne(EDITER, { class: 'bouton discret' }, 'Ajouter un lien'));

  return el('div', {},
    el('ul', { class: 'grille-liens' }, liens.map((lien) => el('li', {},
      lien.url
        ? lienExterne(lien.url, { class: 'lien', dataset: { nom: lien.nom } }, contenu(lien))
        : lienExterne(EDITER, { class: 'lien a-remplir', title: 'Ce lien est vide : clique pour le remplir dans liens.json' }, contenu(lien, 'à ajouter'))))),
    el('p', { class: 'pied' }, lienExterne(EDITER, {}, 'Modifier les liens'), el('span', { class: 'muet' }, ' (liens.json, depuis le site de GitHub)')));
}

function contenu(lien, remarque) {
  return [
    el('span', { class: 'icone', 'aria-hidden': 'true' }, lien.icone ?? '🔗'),
    el('span', { class: 'texte' },
      el('span', { class: 'nom' }, lien.nom),
      el('span', { class: 'note' }, remarque ? `${remarque} · ${lien.note ?? ''}` : lien.note ?? '')),
  ];
}
