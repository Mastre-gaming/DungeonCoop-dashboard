import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depotsDe, regle, regles } from '../src/chemins.js';

const liste = regles(depotsDe({ DEPOTS: 'Mastre-gaming/DungeonCoop, Mastre-gaming/DungeonCoop-dashboard' }));
const sujet = (chemin) => regle(chemin, liste)?.sujet;
const SHA = 'a'.repeat(40);

test('les chemins des widgets sont acceptés, avec le bon sujet', () => {
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/pulls?state=open&per_page=50'), 'prs');
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop-dashboard/pulls/3'), 'prs');
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/pulls/12/reviews?per_page=100'), 'prs');
  assert.equal(sujet(`/repos/Mastre-gaming/DungeonCoop/commits/${SHA}/check-runs?per_page=100`), 'prs');
  assert.equal(sujet(`/repos/Mastre-gaming/DungeonCoop/commits/${SHA}`), null);
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/commits?per_page=10'), 'commits');
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/activity?per_page=15'), 'commits');
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/contents/GAME_SPEC.md'), 'commits');
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/issues?state=open&per_page=100'), 'issues');
  assert.equal(sujet('/repos/Mastre-gaming/DungeonCoop/milestones?state=all&per_page=100'), 'issues');
  assert.equal(regle('/repos/Mastre-gaming/DungeonCoop/pulls/12', liste).mergeable, true);
});

test('tout le reste est refusé : le token ne sert qu’à ces lectures', () => {
  for (const chemin of [
    '/user',
    '/repos/autre/repo/pulls',
    '/repos/Mastre-gaming/DungeonCoopX/pulls',
    '/repos/Mastre-gaming/DungeonCoop/pulls?state=open&q=<script>',
    '/repos/Mastre-gaming/DungeonCoop/contents/../secret.md',
    '/repos/Mastre-gaming/DungeonCoop/contents/.env',
    '/repos/Mastre-gaming/DungeonCoop/commits/abc',
    '/repos/Mastre-gaming/DungeonCoop/actions/secrets',
    '/repos/Mastre-gaming/DungeonCoop/pulls/12/merge',
  ]) {
    assert.equal(regle(chemin, liste), null, chemin);
  }
});
