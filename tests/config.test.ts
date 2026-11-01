import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, loadConfig, parseConfig } from '../src/config.ts';
import { createGit } from '../src/git.ts';
import { GateError } from '../src/types.ts';
import { makeRepo } from './helpers/repo.ts';

test('absent config file → defaults', () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  assert.deepEqual(loadConfig(createGit(r.dir), base), DEFAULT_CONFIG);
});

test('config is read from the base commit, not the head', () => {
  const r = makeRepo();
  r.write('.agentgate.json', JSON.stringify({ rules: { 'test-weakened': 'block' } })); const base = r.commit('b');
  r.write('.agentgate.json', JSON.stringify({ rules: { 'test-weakened': 'off' } })); r.commit('agent disables rule');
  assert.equal(loadConfig(createGit(r.dir), base).rules['test-weakened'], 'block');
});

test('user protectedPaths append to defaults', () => {
  const c = parseConfig('{"protectedPaths":["src/auth/**"]}', 'x');
  assert.ok(c.protectedPaths.includes('.agentgate.json'));
  assert.ok(c.protectedPaths.includes('src/auth/**'));
});

test('invalid JSON, unknown key/rule, bad severity, wrong type → GateError naming the source', () => {
  for (const bad of ['{', '{"rulez":{}}', '{"rules":{"nope":"warn"}}', '{"rules":{"test-weakened":"fatal"}}', '{"testGlobs":"*.ts"}'])
    assert.throws(() => parseConfig(bad, '.agentgate.json@abc123'),
      (e: unknown) => e instanceof GateError && e.message.includes('.agentgate.json@abc123'));
});
