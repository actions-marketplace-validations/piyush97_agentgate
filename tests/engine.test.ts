import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.ts';
import { downgrade, runGate, verdictOf } from '../src/engine.ts';
import { fd } from './helpers/fd.ts';

test('off rules skipped, severities attached, verdict is worst', () => {
  const config = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, 'suppression-added': 'off' as const } };
  const f = runGate([fd('src/a.ts', { added: ['// @ts-ignore'] }), fd('.github/CODEOWNERS')], { config, readFile: () => null });
  assert.deepEqual(f.map((x) => [x.rule, x.severity]), [['guardrail-edited', 'block']]);
  assert.equal(verdictOf(f), 'block');
  assert.equal(verdictOf([]), 'pass');
  assert.equal(verdictOf(downgrade(f)), 'warn');
});

test('warn-only findings do not block', () => {
  const f = runGate([fd('src/a.ts', { added: ['// @ts-ignore'] })], { config: DEFAULT_CONFIG, readFile: () => null });
  assert.deepEqual(f.map((x) => [x.rule, x.severity]), [['suppression-added', 'warn']]);
  assert.equal(verdictOf(f), 'warn');
});
