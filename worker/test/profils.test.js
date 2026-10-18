import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changerProfil, pseudoPris } from '../src/profils.js';

const EQUIPE = [{ github: 'PCrrfng', nom: 'Paul' }, { github: 'DonBabaa', nom: '' }, { github: 'anthonygiauna', nom: '' }];

// Un faux GitHub : chaque token connu donne un login, les autres sont refusés.
function essai({ token = 'jeton-paul', nom, profils = [], equipe = EQUIPE, github = { 'jeton-paul': 'pcrrfng', 'jeton-baba': 'DonBabaa', 'jeton-inconnu': 'quelquun' } } = {}) {
  const ecrits = [];
  const effaces = [];
  const resultat = changerProfil({
    token, corps: { nom }, equipe, profils, maintenant: 42,
    quiEst: async (t) => github[t] ?? null,
    enregistrer: (p) => ecrits.push(p),
    effacer: (g) => effaces.push(g),
  });
  return resultat.then((r) => ({ ...r, ecrits, effaces }));
}

test('un membre change son propre pseudo, rangé sous son compte GitHub tel qu’equipe.json l’écrit', async () => {
  const r = await essai({ nom: '  Mastre   le Grand ' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.profil, { github: 'PCrrfng', nom: 'Mastre le Grand', t: 42 });
  assert.deepEqual(r.ecrits, [r.profil]);
});

test('sans token, avec un token refusé, ou GitHub en panne : rien n’est écrit', async () => {
  assert.equal((await essai({ token: '', nom: 'X' })).status, 401);
  assert.equal((await essai({ token: 'faux', nom: 'X' })).status, 401);
  const panne = await changerProfil({ token: 't', corps: { nom: 'X' }, equipe: EQUIPE, profils: [], quiEst: async () => { throw new Error('réseau'); }, enregistrer: () => assert.fail(), effacer: () => assert.fail() });
  assert.equal(panne.status, 502);
});

test('quelqu’un hors d’equipe.json ne peut rien changer ; equipe.json illisible non plus', async () => {
  const r = await essai({ token: 'jeton-inconnu', nom: 'Paul' });
  assert.equal(r.status, 403);
  assert.match(r.erreur, /@quelquun/);
  assert.equal(r.ecrits.length, 0);
  assert.equal((await essai({ nom: 'X', equipe: null })).status, 503);
});

test('un pseudo invalide est refusé', async () => {
  for (const nom of ['-tiret', 'a'.repeat(41), '<b>', 'ça;va']) assert.equal((await essai({ nom })).status, 400, nom);
});

test('le nom, le pseudo ou le compte d’un autre membre est pris, sans tenir compte des majuscules ni des accents', async () => {
  const profils = [{ github: 'DonBabaa', nom: 'BABA' }];
  for (const nom of ['baba', 'Bàba', 'donbabaa', 'ANTHONYGIAUNA']) assert.equal((await essai({ nom, profils })).status, 409, nom);
  assert.equal((await essai({ token: 'jeton-baba', nom: 'paul' })).status, 409);
});

test('son propre nom, son propre compte ou son propre pseudo restent permis', async () => {
  const profils = [{ github: 'PCrrfng', nom: 'Mastre' }];
  for (const nom of ['Paul', 'PCrrfng', 'mastre']) assert.equal((await essai({ nom, profils })).status, 200, nom);
  assert.equal(pseudoPris('Mastre', 'PCRRFNG', EQUIPE, profils), false);
});

test('un pseudo vide rend le nom d’equipe.json', async () => {
  const r = await essai({ nom: '   ' });
  assert.equal(r.status, 200);
  assert.equal(r.profil, null);
  assert.deepEqual(r.effaces, ['PCrrfng']);
  assert.equal(r.ecrits.length, 0);
});
