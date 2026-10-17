import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { signatureValide, signer } from '../src/signature.js';

const SECRET = 'un-secret-de-test';
const CORPS = JSON.stringify({ zen: 'Keep it logically awesome.', accents: 'é à ç' });

test('une signature faite comme GitHub est acceptée', async () => {
  const commeGithub = `sha256=${createHmac('sha256', SECRET).update(CORPS).digest('hex')}`;
  assert.equal(await signer(SECRET, CORPS), commeGithub);
  assert.equal(await signatureValide(SECRET, CORPS, commeGithub), true);
});

test('tout le reste est refusé', async () => {
  const bonne = await signer(SECRET, CORPS);
  assert.equal(await signatureValide(SECRET, `${CORPS} `, bonne), false, 'corps modifié');
  assert.equal(await signatureValide('autre-secret', CORPS, bonne), false, 'mauvais secret');
  assert.equal(await signatureValide(SECRET, CORPS, bonne.replace('sha256=', 'sha1=')), false, 'mauvais algorithme');
  assert.equal(await signatureValide(SECRET, CORPS, 'sha256=zz'), false, 'pas de l’hexadécimal');
  assert.equal(await signatureValide(SECRET, CORPS, null), false, 'pas d’en-tête');
  assert.equal(await signatureValide('', CORPS, bonne), false, 'pas de secret configuré');
});
