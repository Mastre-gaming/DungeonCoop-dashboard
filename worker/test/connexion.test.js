import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connexion, connexionPrete, etatSigne, lireEtat, pageAutorisee, pagesDe } from '../src/connexion.js';

const PAGES = pagesDe({ PAGES: 'https://dungeoncoop-dashboard.mastredev.workers.dev, https://*-dungeoncoop-dashboard.mastredev.workers.dev/, http://localhost:8000' });
const ENV = { GITHUB_CLIENT_ID: 'id-test', GITHUB_CLIENT_SECRET: 'secret-test', PAGES: PAGES.join(',') };
const PAGE = 'https://dungeoncoop-dashboard.mastredev.workers.dev/?moi=PCrrfng';
const WORKER = 'https://dungeoncoop-direct.mastredev.workers.dev';

test('le token ne repart que vers les pages du dashboard', () => {
  assert.ok(pageAutorisee(PAGE, PAGES));
  assert.ok(pageAutorisee('https://3f2a9c1d-dungeoncoop-dashboard.mastredev.workers.dev/', PAGES), 'un aperçu de branche');
  assert.ok(pageAutorisee('http://localhost:8000/?demo', PAGES));
  for (const page of [
    'https://evil.example/',
    'https://dungeoncoop-dashboard.mastredev.workers.dev.evil.example/',
    'https://evil.example/https://dungeoncoop-dashboard.mastredev.workers.dev',
    'https://x.y-dungeoncoop-dashboard.mastredev.workers.dev/',
    'https://user:pass@dungeoncoop-dashboard.mastredev.workers.dev/',
    'http://localhost:8001/',
    'javascript:alert(1)',
    'pas une adresse',
  ]) {
    assert.equal(pageAutorisee(page, PAGES), false, page);
  }
});

test('le state signé revient tel quel, et rien d’autre ne passe', async () => {
  const etat = await etatSigne('s', PAGE);
  assert.equal(await lireEtat('s', etat), PAGE);
  assert.equal(await lireEtat('autre', etat), null, 'un autre secret');
  const [contenu, signature] = etat.split('.');
  assert.equal(await lireEtat('s', `${contenu}x.${signature}`), null, 'le contenu modifié');
  assert.equal(await lireEtat('s', contenu), null, 'sans signature');
  assert.equal(await lireEtat('s', await etatSigne('s', PAGE, Date.now() - 11 * 60_000)), null, 'plus de 10 minutes');
});

test('sans OAuth App, la connexion le dit au lieu de planter', async () => {
  assert.equal(connexionPrete({}), false);
  assert.equal(connexionPrete(ENV), true);
  const reponse = await connexion(new Request(`${WORKER}/auth/connexion?retour=${encodeURIComponent(PAGE)}`), { PAGES: ENV.PAGES });
  assert.equal(reponse.status, 503);
});

test('connexion : vers GitHub avec la page signée, et refus d’une page inconnue', async () => {
  const refus = await connexion(new Request(`${WORKER}/auth/connexion?retour=${encodeURIComponent('https://evil.example/')}`), ENV);
  assert.equal(refus.status, 400);

  const reponse = await connexion(new Request(`${WORKER}/auth/connexion?retour=${encodeURIComponent(PAGE)}`), ENV);
  assert.equal(reponse.status, 302);
  const github = new URL(reponse.headers.get('Location'));
  assert.equal(github.origin + github.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(github.searchParams.get('client_id'), 'id-test');
  assert.equal(github.searchParams.get('scope'), 'public_repo');
  assert.equal(github.searchParams.get('redirect_uri'), `${WORKER}/auth/retour`);
  assert.equal(await lireEtat('secret-test', github.searchParams.get('state')), PAGE);
});

test('retour : le token repart dans le fragment de la page, jamais ailleurs', async () => {
  const fetchOrigine = globalThis.fetch;
  const envoye = [];
  globalThis.fetch = async (url, options) => {
    envoye.push({ url, corps: JSON.parse(options.body) });
    return Response.json(options && JSON.parse(options.body).code === 'bon' ? { access_token: 'gho_abc', scope: 'public_repo' } : { error: 'bad_verification_code' });
  };
  try {
    const etat = await etatSigne('secret-test', PAGE);
    const bon = await connexion(new Request(`${WORKER}/auth/retour?code=bon&state=${encodeURIComponent(etat)}`), ENV);
    assert.equal(bon.status, 302);
    const page = new URL(bon.headers.get('Location'));
    assert.equal(page.origin + page.pathname + page.search, PAGE);
    assert.equal(page.hash, '#jeton=gho_abc');
    assert.equal(envoye[0].url, 'https://github.com/login/oauth/access_token');
    assert.equal(envoye[0].corps.client_secret, 'secret-test');

    const mauvais = await connexion(new Request(`${WORKER}/auth/retour?code=faux&state=${encodeURIComponent(etat)}`), ENV);
    assert.match(new URL(mauvais.headers.get('Location')).hash, /^#connexion-erreur=/);

    const annule = await connexion(new Request(`${WORKER}/auth/retour?error=access_denied&state=${encodeURIComponent(etat)}`), ENV);
    assert.match(decodeURIComponent(new URL(annule.headers.get('Location')).hash), /annulée/);

    const faux = await connexion(new Request(`${WORKER}/auth/retour?code=bon&state=invente.abc`), ENV);
    assert.equal(faux.status, 400);
    assert.equal(envoye.length, 2, 'un state faux ne va même pas demander de token');
  } finally {
    globalThis.fetch = fetchOrigine;
  }
});
