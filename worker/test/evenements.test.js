import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traduire } from '../src/evenements.js';

const repository = { name: 'DungeonCoop', full_name: 'Mastre-gaming/DungeonCoop', html_url: 'https://github.com/Mastre-gaming/DungeonCoop' };
const sender = { login: 'PCrrfng' };
const t = (evenement, payload) => traduire(evenement, { repository, sender, ...payload });

test('push : qui, combien, sur quelle branche, et le titre du dernier commit', () => {
  const r = t('push', { ref: 'refs/heads/paul/menu', commits: [{}, {}], head_commit: { message: 'Menu : le titre\n\nDétails' }, compare: 'https://x/compare' });
  assert.deepEqual(r.sujets, ['commits', 'prs']);
  assert.equal(r.message.texte, 'PCrrfng a poussé 2 commits sur paul/menu : « Menu : le titre »');
  assert.equal(r.message.lien, 'https://x/compare');
  assert.equal(r.message.depot, 'DungeonCoop');
  assert.equal(t('push', { ref: 'refs/heads/a', created: true, commits: [] }).message.texte, 'PCrrfng a créé la branche a');
  assert.equal(t('push', { ref: 'refs/heads/a', deleted: true }).message.texte, 'PCrrfng a supprimé la branche a');
});

test('PR : ouverte, fusionnée, relecture demandée ; une synchro ne notifie pas', () => {
  const pr = { number: 7, title: 'Le menu titre', html_url: 'https://x/pull/7' };
  assert.equal(t('pull_request', { action: 'opened', pull_request: pr }).message.texte, 'PCrrfng a ouvert la PR #7 « Le menu titre »');
  const fusion = t('pull_request', { action: 'closed', pull_request: { ...pr, merged: true } });
  assert.equal(fusion.message.texte, 'PCrrfng a fusionné la PR #7 « Le menu titre »');
  assert.deepEqual(fusion.sujets, ['prs', 'commits']);
  assert.equal(t('pull_request', { action: 'review_requested', pull_request: pr, requested_reviewer: { login: 'DonBabaa' } }).message.texte,
    'PCrrfng demande à DonBabaa de relire la PR #7');
  const synchro = t('pull_request', { action: 'synchronize', pull_request: pr });
  assert.deepEqual(synchro, { sujets: ['prs'], message: null });
});

test('relecture : approuvée ou changements demandés', () => {
  const pull_request = { number: 7 };
  assert.equal(t('pull_request_review', { action: 'submitted', pull_request, review: { state: 'approved' } }).message.texte, 'PCrrfng a approuvé la PR #7');
  assert.equal(t('pull_request_review', { action: 'submitted', pull_request, review: { state: 'changes_requested' } }).message.texte,
    'PCrrfng demande des changements sur la PR #7');
});

test('tests : seulement GitHub Actions, seulement à la fin', () => {
  const suite = (app, conclusion, action = 'completed') => t('check_suite', { action, check_suite: { app: { slug: app }, conclusion, pull_requests: [{ number: 7 }] } });
  assert.equal(suite('github-actions', 'failure').message.texte, 'Tests rouges sur la PR #7');
  assert.equal(suite('github-actions', 'success').message.texte, 'Tests verts sur la PR #7');
  assert.equal(suite('cloudflare-workers-and-pages', 'success').message, null);
  assert.equal(suite('github-actions', null, 'requested').message, null);
  assert.deepEqual(t('check_run', {}).sujets, ['prs']);
});

test('issues : une idée se dit « propose une idée » ; prendre une tâche se voit', () => {
  const idee = { number: 20, title: 'Une salle d’entraînement', labels: [{ name: 'Idée' }], html_url: 'https://x/issues/20' };
  assert.equal(t('issues', { action: 'opened', issue: idee }).message.texte, 'PCrrfng propose une idée : « Une salle d’entraînement »');
  assert.equal(t('issues', { action: 'assigned', issue: idee, assignee: { login: 'PCrrfng' } }).message.texte, 'PCrrfng prend #20 « Une salle d’entraînement »');
  assert.equal(t('issues', { action: 'assigned', issue: idee, assignee: { login: 'DonBabaa' } }).message.texte, 'PCrrfng confie #20 « Une salle d’entraînement » à DonBabaa');
  assert.deepEqual(t('issues', { action: 'labeled', issue: idee }), { sujets: ['issues'], message: null });
});

test('les titres trop longs sont coupés, et le texte reste du texte', () => {
  const r = t('issues', { action: 'opened', issue: { number: 1, title: `<img src=x onerror=alert(1)> ${'a'.repeat(100)}`, labels: [] } });
  assert.ok(r.message.texte.length < 120);
  assert.ok(r.message.texte.includes('<img'), 'le Worker n’échappe rien : c’est la page qui affiche en texte');
});

test('ping : la confirmation que le webhook est branché ; le reste est ignoré', () => {
  assert.equal(t('ping', {}).message.texte, 'Webhook branché sur DungeonCoop ✔');
  assert.deepEqual(t('star', {}), { sujets: [], message: null });
});
