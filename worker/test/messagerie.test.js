import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Limiteur, Messagerie, nettoyerTexte } from '../src/messagerie.js';
import { creerJeton } from '../src/session.js';

const SECRET = 'mot-de-passe-de-test';

function messagerie(options = {}) {
  const messages = [];
  const stockage = {
    ajouter: (m) => (messages.push({ ...m, id: messages.length + 1 }), messages.length),
    derniers: (n) => messages.slice(-n),
  };
  return { messages, m: new Messagerie({ secret: SECRET, stockage, ...options }) };
}

const json = (objet) => JSON.stringify(objet);

test('le laissez-passer de l’entrée ouvre la messagerie, avec son nom et l’historique', async () => {
  const { m, messages } = messagerie();
  messages.push({ id: 1, auteur: 'Ayla', texte: 'salut', t: 1 });
  const { attachement, envoyer } = await m.traiter(json({ type: 'jeton', jeton: await creerJeton(SECRET, 'Paul') }));
  assert.deepEqual(attachement, { equipe: true, nom: 'Paul' });
  assert.equal(envoyer[0].type, 'bienvenue');
  assert.equal(envoyer[0].nom, 'Paul');
  assert.deepEqual(envoyer[0].messages.map((x) => x.texte), ['salut']);
});

test('un faux laissez-passer, ou sans secret : refusé', async () => {
  const { m } = messagerie();
  const faux = await m.traiter(json({ type: 'jeton', jeton: await creerJeton('autre', 'Paul') }));
  assert.equal(faux.envoyer[0].type, 'refuse');
  assert.equal(faux.attachement.equipe, false);
  const sansSecret = new Messagerie({ secret: '', stockage: { derniers: () => [] } });
  assert.match((await sansSecret.traiter(json({ type: 'jeton', jeton: 'x' }))).envoyer[0].raison, /MOT_DE_PASSE/);
});

test('envoyer : le nom vient du laissez-passer, jamais de la page ; diffusé à tous', async () => {
  const { m, messages } = messagerie({ maintenant: () => 1234 });
  const r = await m.traiter(json({ type: 'envoyer', ref: 'a1', texte: '  je prends la #12  ', auteur: 'DonBabaa' }), { equipe: true, nom: 'Paul' });
  assert.deepEqual(r.envoyer, [{ type: 'envoye', ref: 'a1', id: 1 }]);
  assert.deepEqual(r.diffuser, [{ type: 'message', message: { auteur: 'Paul', texte: 'je prends la #12', t: 1234, id: 1 } }]);
  assert.equal(messages[0].auteur, 'Paul');
});

test('sans être entré, vide, trop long ou trop vite : refusé', async () => {
  const { m, messages } = messagerie({ limiteur: new Limiteur({ max: 2, fenetre: 1000, maintenant: () => 0 }) });
  const entre = { equipe: true, nom: 'Paul' };
  assert.equal((await m.traiter(json({ type: 'envoyer', ref: 1, texte: 'coucou' }), { equipe: false })).envoyer[0].type, 'erreur');
  assert.equal((await m.traiter(json({ type: 'envoyer', ref: 2, texte: '   ' }), entre)).envoyer[0].type, 'erreur');
  assert.equal((await m.traiter(json({ type: 'envoyer', ref: 3, texte: 'x'.repeat(501) }), entre)).envoyer[0].type, 'erreur');
  await m.traiter(json({ type: 'envoyer', ref: 4, texte: 'un' }), entre);
  await m.traiter(json({ type: 'envoyer', ref: 5, texte: 'deux' }), entre);
  const trop = await m.traiter(json({ type: 'envoyer', ref: 6, texte: 'trois' }), entre);
  assert.match(trop.envoyer[0].erreur, /Doucement/);
  assert.equal(messages.length, 2);
  assert.deepEqual((await m.traiter('pas du json', entre)).envoyer, []);
});

test('le texte : propre, sans caractères de contrôle, lignes vides limitées', () => {
  assert.equal(nettoyerTexte('  a\r\nb\n\n\n\nc\u0007 '), 'a\nb\n\nc');
  assert.equal(nettoyerTexte('<b>reste du texte</b>'), '<b>reste du texte</b>', 'c’est la page qui affiche en texte');
  assert.equal(nettoyerTexte(42), null);
});
