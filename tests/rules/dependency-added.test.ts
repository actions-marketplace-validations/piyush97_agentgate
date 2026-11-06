import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/config.ts';
import { dependencyAdded } from '../../src/rules/dependency-added.ts';
import { fd } from '../helpers/fd.ts';

const ctx = { config: DEFAULT_CONFIG, readFile: () => null };

test('new npm deps and lifecycle scripts reported; version bumps not', () => {
  const files: Record<string, string> = {
    'base:package.json': JSON.stringify({ dependencies: { a: '^1.0.0' } }),
    'head:package.json': JSON.stringify({ dependencies: { a: '^2.0.0', 'left-pad': '1.3.0' }, scripts: { postinstall: 'node x.js' } }),
  };
  const c = { config: DEFAULT_CONFIG, readFile: (ref: 'base' | 'head', p: string) => files[`${ref}:${p}`] ?? null };
  assert.deepEqual(dependencyAdded.check([fd('package.json')], c).map((f) => f.message),
    ['New dependency: left-pad@1.3.0 (dependencies). Check the package is intended, then apply "agentgate-approved" after review.', 'Install lifecycle script changed: postinstall. It runs arbitrary code at install time, so review it before approving.']);
});
test('invalid head package.json does not throw', () => {
  const c = { config: DEFAULT_CONFIG, readFile: (ref: 'base' | 'head') => (ref === 'head' ? '{ nope' : null) };
  assert.deepEqual(dependencyAdded.check([fd('pkg/package.json', { status: 'added' })], c).map((f) => f.message), ['package.json is not valid JSON: fix the syntax so the gate can read the dependency list.']);
});
test('requirements.txt: new names flagged, pin changes and -r lines not', () => {
  const out = dependencyAdded.check([fd('requirements.txt', { removed: ['requests==2.31.0'],
    added: [[1, 'requests==2.32.0'], [2, 'evil-pkg>=0.1  # helper'], [3, '-r base.txt']] })], ctx);
  assert.deepEqual(out.map((f) => f.line), [2]);
});

test('renamed package reads the old path and reports only new dependencies', () => {
  const files: Record<string, string> = {
    'base:old/package.json': JSON.stringify({ dependencies: { existing: '^1' } }),
    'head:new/package.json': JSON.stringify({ dependencies: { existing: '^2', added: '^1' } }),
  };
  const c = { config: DEFAULT_CONFIG, readFile: (ref: 'base' | 'head', p: string) => files[`${ref}:${p}`] ?? null };
  assert.deepEqual(dependencyAdded.check([fd('new/package.json', { status: 'renamed', oldPath: 'old/package.json' })], c).map(f => f.message), ['New dependency: added@^1 (dependencies). Check the package is intended, then apply "agentgate-approved" after review.']);
});

test('new dependencies named like Object properties are still reported', () => {
  const c = { config: DEFAULT_CONFIG, readFile: (ref: 'base' | 'head') => ref === 'head' ? '{"dependencies":{"constructor":"^1"}}' : '{"dependencies":{}}' };
  assert.deepEqual(dependencyAdded.check([fd('package.json')], c).map(f => f.message), ['New dependency: constructor@^1 (dependencies). Check the package is intended, then apply "agentgate-approved" after review.']);
});

test('binary-marked requirements files require review instead of passing silently', () => {
  const findings = dependencyAdded.check([fd('requirements.txt', { binary: true })], ctx);
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.message, /commit plain text so the change can be reviewed/);
});
