import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cache } from '../src/cache.js';

// Un faux GitHub : il compte les appels et renvoie ce qu'on lui dit.
function fauxGithub(reponses = {}) {
  const appels = [];
  return {
    appels,
    async recuperer(chemin) {
      appels.push(chemin);
      const r = typeof reponses[chemin] === 'function' ? reponses[chemin]() : reponses[chemin];
      return r ?? { status: 200, corps: `{"chemin":"${chemin}","n":${appels.length}}` };
    },
  };
}

const PRS = { sujet: 'prs' };
const ISSUES = { sujet: 'issues' };

test('une même lecture ne part qu’une fois, même demandée par quatre pages en même temps', async () => {
  const github = fauxGithub();
  const cache = new Cache({ recuperer: github.recuperer });
  const reponses = await Promise.all([1, 2, 3, 4].map(() => cache.lire('/a', PRS)));
  assert.equal(github.appels.length, 1);
  assert.ok(reponses.every((r) => r === reponses[0]));
  await cache.lire('/a', PRS);
  assert.equal(github.appels.length, 1);
});

test('un webhook rend périmé son sujet, pas les autres', async () => {
  const github = fauxGithub();
  const cache = new Cache({ recuperer: github.recuperer });
  await cache.lire('/prs', PRS);
  await cache.lire('/issues', ISSUES);
  cache.invalider(['prs']);
  await cache.lire('/prs', PRS);
  await cache.lire('/issues', ISSUES);
  assert.deepEqual(github.appels, ['/prs', '/issues', '/prs']);
});

test('une réponse reçue pendant un webhook n’est pas gardée (elle peut être déjà vieille)', async () => {
  let liberer;
  const github = fauxGithub({ '/lent': () => new Promise((ok) => { liberer = () => ok({ status: 200, corps: '{"vieux":true}' }); }) });
  const cache = new Cache({ recuperer: github.recuperer });
  const enVol = cache.lire('/lent', PRS);
  await new Promise((ok) => setImmediate(ok));
  cache.invalider(['prs']);
  liberer();
  await enVol;
  github.recuperer = async (chemin) => { github.appels.push(chemin); return { status: 200, corps: '{"neuf":true}' }; };
  cache.recuperer = github.recuperer;
  assert.equal((await cache.lire('/lent', PRS)).corps, '{"neuf":true}');
});

test('le filet de sécurité : au bout de 2 minutes, on relit même sans webhook', async () => {
  let t = 0;
  const github = fauxGithub();
  const cache = new Cache({ recuperer: github.recuperer, maintenant: () => t });
  await cache.lire('/a', ISSUES);
  t = 119_000;
  await cache.lire('/a', ISSUES);
  t = 121_000;
  await cache.lire('/a', ISSUES);
  assert.equal(github.appels.length, 2);
});

test('un conflit pas encore calculé (mergeable: null) est relu après 5 s', async () => {
  let t = 0;
  const github = fauxGithub({ '/pulls/1': { status: 200, corps: '{"mergeable": null}' } });
  const cache = new Cache({ recuperer: github.recuperer, maintenant: () => t });
  const regle = { sujet: 'prs', mergeable: true };
  await cache.lire('/pulls/1', regle);
  t = 6_000;
  await cache.lire('/pulls/1', regle);
  assert.equal(github.appels.length, 2);
});

test('un commit précis est gardé un jour, et aucun webhook ne l’efface', async () => {
  let t = 0;
  const github = fauxGithub();
  const cache = new Cache({ recuperer: github.recuperer, maintenant: () => t });
  await cache.lire('/commits/sha', { sujet: null });
  cache.invalider(['prs', 'commits', 'issues']);
  t = 23 * 3600_000;
  await cache.lire('/commits/sha', { sujet: null });
  assert.equal(github.appels.length, 1);
});

test('limite atteinte ou GitHub en panne : on rend la dernière bonne réponse', async () => {
  let t = 0;
  let status = 200;
  const github = fauxGithub({ '/a': () => ({ status, corps: status === 200 ? '{"bon":true}' : '{"message":"rate limit"}' }) });
  const cache = new Cache({ recuperer: github.recuperer, maintenant: () => t });
  await cache.lire('/a', PRS);
  t = 200_000;
  status = 403;
  assert.equal((await cache.lire('/a', PRS)).corps, '{"bon":true}');
  status = 503;
  assert.equal((await cache.lire('/a', PRS)).corps, '{"bon":true}');
});

test('une erreur sans réponse en réserve est rendue telle quelle', async () => {
  const github = fauxGithub({ '/absent': { status: 404, corps: '{"message":"Not Found"}' } });
  const cache = new Cache({ recuperer: github.recuperer });
  assert.equal((await cache.lire('/absent', PRS)).status, 404);
  const panne = new Cache({ recuperer: async () => { throw new Error('réseau'); } });
  assert.equal((await panne.lire('/x', PRS)).status, 502);
});

test('le cache ne grossit pas sans fin', async () => {
  const github = fauxGithub();
  const cache = new Cache({ recuperer: github.recuperer, taille: 3 });
  for (const c of ['/1', '/2', '/3', '/4']) await cache.lire(c, PRS);
  assert.equal(cache.entrees.size, 3);
  assert.ok(!cache.entrees.has('/1'));
});
