import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerJeton, lireJeton, motDePasseValide, nomValide } from '../src/session.js';

const SECRET = 'mot-de-passe-de-test';

test('un jeton se relit avec son nom, accents compris', async () => {
  const jeton = await creerJeton(SECRET, 'Léa Brams');
  assert.match(jeton, /^v1\.\d+\.[\w-]+\.[\w-]+$/);
  assert.equal((await lireJeton(SECRET, jeton)).nom, 'Léa Brams');
});

test('un jeton trafiqué, expiré, ou signé avec un autre mot de passe est refusé', async () => {
  const jeton = await creerJeton(SECRET, 'Paul', { maintenant: 1000, duree: 1000 });
  assert.equal((await lireJeton(SECRET, jeton, { maintenant: 1500 })).nom, 'Paul');
  assert.equal(await lireJeton(SECRET, jeton, { maintenant: 2000 }), null, 'expiré');
  assert.equal(await lireJeton('ancien-mot-de-passe', jeton, { maintenant: 1500 }), null, 'mot de passe changé');
  const [v, fin, , signature] = jeton.split('.');
  const autreNom = Buffer.from('DonBabaa').toString('base64url');
  assert.equal(await lireJeton(SECRET, [v, fin, autreNom, signature].join('.'), { maintenant: 1500 }), null, 'nom changé');
  assert.equal(await lireJeton(SECRET, [v, '9999999999999', jeton.split('.')[2], signature].join('.'), { maintenant: 1500 }), null, 'date changée');
  for (const faux of ['', 'abc', 'v1.1.2', 'v2.1.2.3', null, 'v1.x.UGF1bA.abc', 'a'.repeat(500)]) {
    assert.equal(await lireJeton(SECRET, faux), null, String(faux));
  }
  assert.equal(await lireJeton('', jeton), null, 'pas de secret');
});

test('le mot de passe : juste ou faux, sans raccourci', () => {
  assert.equal(motDePasseValide('caca-test', 'caca-test'), true);
  assert.equal(motDePasseValide('caca-test', 'caca-tesT'), false);
  assert.equal(motDePasseValide('caca-test', 'caca'), false);
  assert.equal(motDePasseValide('caca-test', 'caca-test!'), false);
  assert.equal(motDePasseValide('', ''), false);
  assert.equal(motDePasseValide('x', undefined), false);
});

test('un nom de dev lisible partout', () => {
  for (const ok of ['Paul', 'DonBabaa', 'anthony-giauna', 'Léa', 'Fraps 2', "N'Golo"]) assert.equal(nomValide(ok), true, ok);
  for (const ko of ['', ' Paul', 'Paul ', '<b>', 'a"b', '-tiret', 'x'.repeat(41), 'ligne\nsuite']) assert.equal(nomValide(ko), false, JSON.stringify(ko));
});
