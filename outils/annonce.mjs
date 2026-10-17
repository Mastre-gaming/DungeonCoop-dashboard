#!/usr/bin/env node
// Poster un message dans la messagerie du dashboard depuis un terminal : pour Claude (« PR #12 en conflit,
// je ne la fusionne pas »), ou pour un script. Le message arrive en direct sur les pages ouvertes.
//
//   MOT_DE_PASSE=… node outils/annonce.mjs "⚠ PR #12 : conflit avec main dans src/main.js, @Paul"
//   options : --nom Claude (le nom qui signe, Claude par défaut)
//             --direct http://localhost:8787 (un autre Worker que celui de src/config.js)
//
// Le mot de passe ne va jamais dans ce fichier : il vient de la variable MOT_DE_PASSE (celui de l'entrée).
// Le laissez-passer est fabriqué ici, comme le ferait la porte, et ne dure que 5 minutes.

import { config } from '../src/config.js';
import { creerJeton } from '../worker/src/session.js';

const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  if (i < 0) return defaut;
  const valeur = args[i + 1];
  args.splice(i, 2);
  return valeur;
};
const nom = option('--nom', 'Claude');
const direct = option('--direct', config.direct).replace(/\/+$/, '');
const texte = args.join(' ').trim();

function arreter(message) {
  console.error(message);
  process.exit(1);
}

if (!texte) arreter('Rien à envoyer. Exemple : MOT_DE_PASSE=… node outils/annonce.mjs "Le message"');
if (!process.env.MOT_DE_PASSE) arreter('Il manque la variable MOT_DE_PASSE (le mot de passe de l’entrée du dashboard).');
if (!direct) arreter('Pas d’adresse de Worker : config.direct est vide, et --direct n’est pas donné.');

const jeton = await creerJeton(process.env.MOT_DE_PASSE, nom, { duree: 5 * 60_000 });
const socket = new WebSocket(`${direct.replace(/^http/, 'ws')}/direct`);
const delai = setTimeout(() => arreter('Le Worker ne répond pas (10 s).'), 10_000);

socket.addEventListener('error', () => arreter(`Impossible de joindre ${direct}.`));
socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'jeton', jeton })));
socket.addEventListener('message', (evenement) => {
  let message;
  try {
    message = JSON.parse(evenement.data);
  } catch {
    return;
  }
  if (message.type === 'bienvenue') socket.send(JSON.stringify({ type: 'envoyer', ref: 'annonce', texte }));
  if (message.type === 'refuse') arreter(`Refusé : ${message.raison}`);
  if (message.type === 'erreur' && message.ref === 'annonce') arreter(`Refusé : ${message.erreur}`);
  if (message.type === 'envoye' && message.ref === 'annonce') {
    clearTimeout(delai);
    console.log(`Envoyé dans la messagerie (message n° ${message.id}), signé « ${nom} ».`);
    socket.close();
    process.exit(0);
  }
});
