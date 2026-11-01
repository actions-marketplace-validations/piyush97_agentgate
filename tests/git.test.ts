import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGit } from '../src/git.ts';
import { GateError } from '../src/types.ts';
import { makeRepo } from './helpers/repo.ts';

test('changes() reports added, modified, deleted, renamed; paths with spaces and unicode', () => {
  const r = makeRepo();
  r.write('src/keep.ts', 'a\n'); r.write('tests/old name.test.ts', 'expect(1).toBe(1)\n'.repeat(5)); r.write('gone.ts', 'x\n');
  const base = r.commit('base');
  r.write('src/keep.ts', 'a\nb\n'); r.write('docs/ünï cødé.md', 'hi\n'); r.rm('gone.ts');
  r.git('mv', 'tests/old name.test.ts', 'tests/new name.test.ts');
  const head = r.commit('head');
  const byPath = Object.fromEntries(createGit(r.dir).changes(base, head).map((f) => [f.path, f]));
  assert.equal(byPath['src/keep.ts']!.status, 'modified');
  assert.deepEqual(byPath['src/keep.ts']!.added, [{ line: 2, text: 'b' }]);
  assert.equal(byPath['docs/ünï cødé.md']!.status, 'added');
  assert.equal(byPath['gone.ts']!.status, 'deleted');
  assert.equal(byPath['tests/new name.test.ts']!.status, 'renamed');
  assert.equal(byPath['tests/new name.test.ts']!.oldPath, 'tests/old name.test.ts');
});

test('binary files are marked binary with no lines', () => {
  const r = makeRepo(); r.write('a.txt', 'a\n'); const base = r.commit('b');
  r.write('logo.png', Buffer.from([0x89, 0x50, 0x00, 0x01, 0x00])); const head = r.commit('h');
  const [f] = createGit(r.dir).changes(base, head);
  assert.equal(f!.binary, true); assert.deepEqual(f!.added, []);
});

test('resolve() on a missing SHA throws GateError mentioning fetch-depth: 0', () => {
  const r = makeRepo(); r.write('a', 'a\n'); r.commit('b');
  assert.throws(() => createGit(r.dir).resolve('0123456789abcdef0123456789abcdef01234567'),
    (e: unknown) => e instanceof GateError && /fetch-depth: 0/.test(e.message));
});

test('show() returns content at ref and null when absent', () => {
  const r = makeRepo(); r.write('.agentgate.json', '{"a":1}'); const base = r.commit('b');
  const g = createGit(r.dir);
  assert.equal(g.show(base, '.agentgate.json'), '{"a":1}');
  assert.equal(g.show(base, 'nope.json'), null);
});
