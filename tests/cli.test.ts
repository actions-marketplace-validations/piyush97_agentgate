import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.ts';
import { makeRepo } from './helpers/repo.ts';

function run(cwd: string, args: string[]) {
  let out = '';
  let err = '';
  const code = main(args, { cwd, out: (s) => { out += s; }, err: (s) => { err += s; } });
  return { code, out, err };
}

test('clean PR → 0, PASS', () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('src/a.ts', 'export const a = 1;\n'); r.commit('h');
  const res = run(r.dir, ['check', '--base', base]);
  assert.equal(res.code, 0);
  assert.match(res.out, /agentgate: PASS/);
});

test('skip added in test → 1 with file:line', () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('tests/a.test.ts', 'test("x", () => {\n  it.skip("y", () => {});\n});\n'); r.commit('h');
  const res = run(r.dir, ['check', '--base', base]);
  assert.equal(res.code, 1);
  assert.match(res.out, /tests\/a\.test\.ts:2/);
});

test('agent disables rule in head .agentgate.json → still 1, both findings', () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('.agentgate.json', JSON.stringify({ rules: { 'test-weakened': 'off' } }));
  r.write('tests/a.test.ts', 'test("x", () => {\n  it.skip("y", () => {});\n});\n');
  r.commit('h');
  const res = run(r.dir, ['check', '--base', base]);
  assert.equal(res.code, 1);
  assert.match(res.out, /test-weakened/);
  assert.match(res.out, /\.agentgate\.json/);
});

test('--format json parses', () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('tests/a.test.ts', 'it.skip("y", () => {});\n'); r.commit('h');
  const res = run(r.dir, ['check', '--base', base, '--format', 'json']);
  assert.equal(JSON.parse(res.out).verdict, 'block');
});

test('missing --base or unknown base SHA → 2 on stderr', () => {
  const r = makeRepo(); r.write('a', 'a\n'); r.commit('b');
  assert.equal(run(r.dir, ['check']).code, 2);
  const res = run(r.dir, ['check', '--base', 'f'.repeat(40)]);
  assert.equal(res.code, 2);
  assert.match(res.err, /fetch-depth: 0/);
});

test('unknown --format and --help', () => {
  const r = makeRepo(); r.write('a', 'a\n'); r.commit('b');
  assert.equal(run(r.dir, ['check', '--base', 'HEAD', '--format', 'xml']).code, 2);
  const help = run(r.dir, ['--help']);
  assert.equal(help.code, 0);
  assert.match(help.out, /Usage: agentgate check/);
});

test('missing merge history is an environment error with checkout guidance', () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.git('checkout', '--orphan', 'unrelated'); r.commit('unrelated head');
  const result = run(r.dir, ['check', '--base', base]);
  assert.equal(result.code, 2);
  assert.match(result.err, /fetch-depth: 0/);
});

test('extra positional arguments are usage errors', () => {
  assert.equal(run('.', ['check', 'typo', '--base', 'HEAD']).code, 2);
});

test('binary attributes cannot hide a new dependency or install script', () => {
  const r = makeRepo();
  r.write('.agentgate.json', '{"rules":{"dependency-added":"block"}}');
  r.write('package.json', '{"dependencies":{}}'); const base = r.commit('b');
  r.write('.gitattributes', 'package.json -diff\n');
  r.write('package.json', '{"dependencies":{"new-package":"^1"},"scripts":{"postinstall":"node setup.js"}}'); r.commit('h');
  const result = run(r.dir, ['check', '--base', base, '--format', 'json']);
  assert.equal(result.code, 1);
  const report = JSON.parse(result.out);
  assert.deepEqual(report.findings.map((f: { message: string }) => f.message), ['New dependency: new-package@^1 (dependencies). Check the package is intended, then apply "agentgate-approved" after review.', 'Install lifecycle script changed: postinstall. It runs arbitrary code at install time, so review it before approving.']);
});

test('CLI from a subdirectory still reads root config and complete diff lines', () => {
  const r = makeRepo();
  r.write('.agentgate.json', '{"rules":{"suppression-added":"block"}}');
  r.write('sub/a.ts', 'export const x = 1;\n'); const base = r.commit('b');
  r.write('sub/a.ts', 'export const x = 1;\n// @ts-ignore\n'); r.commit('h');
  const result = run(`${r.dir}/sub`, ['check', '--base', base, '--format', 'json']);
  assert.equal(result.code, 1);
  const report = JSON.parse(result.out);
  assert.equal(report.findings[0].severity, 'block');
  assert.equal(report.findings[0].file, 'sub/a.ts');
  assert.equal(report.findings[0].line, 2);
});
