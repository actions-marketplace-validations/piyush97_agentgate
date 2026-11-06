import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/config.ts';
import { testWeakened } from '../../src/rules/test-weakened.ts';
import { fd } from '../helpers/fd.ts';

const ctx = { config: DEFAULT_CONFIG, readFile: () => null };

test('deleted test file blocks', () => {
  assert.deepEqual(testWeakened.check([fd('src/a.test.ts', { status: 'deleted', removed: ['expect(1)'] })], ctx).map((f) => f.message), ['Test file deleted: restore it, or have a reviewer apply "agentgate-approved".']);
});
test('renamed out of test paths', () => {
  assert.match(testWeakened.check([fd('src/a.ts', { status: 'renamed', oldPath: 'src/a.test.ts' })], ctx)[0]!.message, /Test moved out of the test paths/);
});
test('.skip/.only/xit/pytest skip flagged with line numbers', () => {
  const out = testWeakened.check([
    fd('tests/x.test.ts', { added: [[7, 'it.skip("a", () => {})'], [9, 'describe.only("b", f)'], [11, '  xit("c")']] }),
    fd('tests/test_y.py', { added: [[3, '@pytest.mark.skip(reason="flaky")']] })], ctx);
  assert.deepEqual(out.map((f) => f.line), [7, 9, 11, 3]);
});
test('net assertion loss flagged once; moved assertions are not', () => {
  const lost = testWeakened.check([fd('a.test.ts', { removed: ['expect(a).toBe(1)', 'expect(b).toBe(2)'], added: ['expect(a).toBeTruthy()'] })], ctx);
  assert.deepEqual(lost.map((f) => f.message), ['Net 1 assertion(s) removed across test files: add the assertions back, or have a reviewer apply "agentgate-approved".']);
  const moved = testWeakened.check([fd('a.test.ts', { removed: ['expect(a).toBe(1)'] }), fd('b.test.ts', { added: ['expect(a).toBe(1)'] })], ctx);
  assert.deepEqual(moved, []);
});
test('skip strings outside test paths are ignored', () => {
  assert.deepEqual(testWeakened.check([fd('docs/testing.md', { added: ['use it.skip( sparingly'] })], ctx), []);
});

test('binary changes to test paths require review even without parsed lines', () => {
  const findings = testWeakened.check([fd('tests/a.test.ts', { binary: true })], ctx);
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.message, /Binary test file changed:/);
});
