import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHunks } from '../src/diff.ts';

test('tracks old and new line numbers per hunk', () => {
  const patch = [
    'diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts',
    '@@ -3,2 +3 @@', '-  expect(x).toBe(1);', '-  expect(y).toBe(2);', '+  expect(x).toBeTruthy();',
    '@@ -10,0 +10,1 @@', '+it.skip("slow", () => {});',
  ].join('\n');
  assert.deepEqual(parseHunks(patch), {
    binary: false,
    removed: [{ line: 3, text: '  expect(x).toBe(1);' }, { line: 4, text: '  expect(y).toBe(2);' }],
    added: [{ line: 3, text: '  expect(x).toBeTruthy();' }, { line: 10, text: 'it.skip("slow", () => {});' }],
  });
});

test('ignores "\\ No newline at end of file" markers', () => {
  const patch = ['--- a/x', '+++ b/x', '@@ -1 +1 @@', '-a', '\\ No newline at end of file', '+b', '\\ No newline at end of file'].join('\n');
  const r = parseHunks(patch);
  assert.deepEqual(r.removed, [{ line: 1, text: 'a' }]);
  assert.deepEqual(r.added, [{ line: 1, text: 'b' }]);
});

test('flags binary patches with no lines', () => {
  assert.deepEqual(parseHunks('Binary files a/logo.png and b/logo.png differ\n'), { binary: true, added: [], removed: [] });
});

test('"---"/"+++" content lines inside a hunk are content, not headers', () => {
  const patch = ['--- a/x.md', '+++ b/x.md', '@@ -1 +1,2 @@', '-old', '+++ not a header', '+--- also content'].join('\n');
  assert.equal(parseHunks(patch).added.length, 2);
});
