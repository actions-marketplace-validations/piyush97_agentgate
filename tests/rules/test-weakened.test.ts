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
test('xUnit ActiveIssue and Skip= flagged (dotnet/runtime#137001 field trial)', () => {
  const out = testWeakened.check([
    fd('src/tests/StackTraces.cs', { added: [[18, '        // ActiveIssue https://github.com/dotnet/runtime/issues/136676'], [20, '[Fact(DisplayName = "a", Skip = "flaky")]'], [22, '[Fact]']] })], ctx);
  assert.deepEqual(out.map((f) => f.line), [18, 20]);
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
test('C#, Rust and GoogleTest assertions count toward net assertion loss', () => {
  const removed = [
    'Assert.Equal(1, x);',
    'Assert.True(ok);',
    'Assert.Throws<ArgumentException>(() => f());',
    'Assert.That(x, Is.EqualTo(1));',
    'CollectionAssert.AreEqual(a, b);',
    'assert_eq!(a, b);',
    'debug_assert!(ok);',
    'EXPECT_EQ(a, b);',
    'ASSERT_TRUE(ok);',
  ];
  const out = testWeakened.check([fd('tests/Foo.Tests/FooTests.cs', { removed })], ctx);
  assert.deepEqual(out.map((f) => f.message), ['Net 9 assertion(s) removed across test files: add the assertions back, or have a reviewer apply "agentgate-approved".']);
});
test('non-assertion lines that look similar are not counted', () => {
  const removed = ['var assertion = new Assertion();', 'Assertions = 1;', 'ASSERT_OK = 1;', '// Assert the result', 'EXPECTED_VALUE(1)'];
  assert.deepEqual(testWeakened.check([fd('tests/a.test.ts', { removed })], ctx), []);
});
test('Jest/Jasmine, RSpec/Minitest, pytest, unittest, NUnit/MSTest and Rust skip markers flagged', () => {
  const out = testWeakened.check([
    fd('tests/a.test.ts', { added: [[1, 'describe.skip.each([1])("a", f)'], [2, 'test.only.each(rows)("b", f)'], [3, 'test.concurrent.skip("c", f)'], [4, "  fit('focused', () => {})"], [5, 'fdescribe(`suite`, f)']] }),
    fd('tests/models/user_test.rb', { added: [[1, '    skip "flaky on CI"'], [2, '  xit "does a thing" do'], [3, 'xdescribe User do'], [4, "  fcontext 'admin' do"]] }),
    fd('tests/test_z.py', { added: [[1, '    pytest.skip("no network")'], [2, '    pytest.xfail("bug 12")'], [3, '        self.skipTest("slow")']] }),
    fd('tests/Foo.Tests/FooTests.cs', { added: [[1, '[Ignore("flaky")]'], [2, '[Test, Ignore("flaky")]'], [3, '[TestMethod, Ignore]']] }),
    fd('tests/it.rs', { added: [[1, '#[ignore]'], [2, '#[ignore = "slow"]']] }),
  ], ctx);
  assert.deepEqual(out.map((f) => `${f.file}:${f.line}`), [
    'tests/a.test.ts:1', 'tests/a.test.ts:2', 'tests/a.test.ts:3', 'tests/a.test.ts:4', 'tests/a.test.ts:5',
    'tests/models/user_test.rb:1', 'tests/models/user_test.rb:2', 'tests/models/user_test.rb:3', 'tests/models/user_test.rb:4',
    'tests/test_z.py:1', 'tests/test_z.py:2', 'tests/test_z.py:3',
    'tests/Foo.Tests/FooTests.cs:1', 'tests/Foo.Tests/FooTests.cs:2', 'tests/Foo.Tests/FooTests.cs:3',
    'tests/it.rs:1', 'tests/it.rs:2',
  ]);
});
test('lookalikes of skip markers are not flagged', () => {
  const added = [
    'model.fit(X, y)', 'fit(X, y)', 'fitness("x")', 'exit("bye")', 'const skip = 1;', 'skip_count += 1', 'skipped "x"',
    'it("skips empty lines", f)', 'describe("only admins", f)', 'pytest.importorskip("numpy")',
    '#[test]', '[Test]', '[TestMethod]', '[IgnoreDataMember]', 'IgnoreCase = true', 'fixture.describe("x")',
  ];
  assert.deepEqual(testWeakened.check([fd('tests/a.test.ts', { added })], ctx), []);
});
