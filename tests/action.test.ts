import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { overrideBy, run } from '../src/action.ts';
import type { LabelEvent } from '../src/action.ts';
import { makeRepo } from './helpers/repo.ts';

const L = 'agentgate-approved';
const ev = (login: string, type: string, event = 'labeled'): LabelEvent => ({ event, label: { name: L }, actor: { login, type } });

test('override accepted from a human reviewer', () => {
  assert.deepEqual(overrideBy([ev('piyush97', 'User')], L, 'copilot-swe-agent[bot]'), { accepted: true, reason: 'applied by @piyush97' });
});
test('override rejected for bot, PR author, or later unlabel', () => {
  assert.equal(overrideBy([ev('github-actions[bot]', 'Bot')], L, 'dev').accepted, false);
  assert.equal(overrideBy([ev('dev', 'User')], L, 'dev').accepted, false);
  assert.equal(overrideBy([ev('lead', 'User'), ev('lead', 'User', 'unlabeled')], L, 'dev').reason, 'label was removed');
});

function env(dir: string, event: unknown): { env: NodeJS.ProcessEnv; summary: string; output: string } {
  const scratch = mkdtempSync(join(tmpdir(), 'agentgate-action-'));
  const eventPath = join(scratch, 'event.json');
  const summary = join(scratch, 'summary.md');
  const output = join(scratch, 'output.txt');
  writeFileSync(eventPath, JSON.stringify(event));
  writeFileSync(summary, '');
  writeFileSync(output, '');
  return {
    env: {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: output,
      GITHUB_WORKSPACE: dir,
      GITHUB_API_URL: 'https://api.example.com',
      GITHUB_REPOSITORY: 'o/r',
      'INPUT_CONFIG-PATH': '.agentgate.json',
      'INPUT_GITHUB-TOKEN': 't',
    },
    summary,
    output,
  };
}

const prEvent = (base: string, head: string, labels: string[] = [], author = 'dev') => ({
  pull_request: { number: 1, base: { sha: base }, head: { sha: head }, user: { login: author }, labels: labels.map((name) => ({ name })) },
});

test('run(): non-PR event → 2', async () => {
  const r = makeRepo(); r.write('a', 'a\n'); r.commit('b');
  const { env: e } = env(r.dir, { push: {} });
  assert.equal(await run(e, () => { throw new Error('fetch must not be called'); }), 2);
});

test('run(): blocking PR writes summary, annotations, verdict output', async () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('tests/a.test.ts', 'it.skip("y", () => {});\n'); const head = r.commit('h');
  const { env: e, summary, output } = env(r.dir, prEvent(base, head));
  const code = await run(e, () => { throw new Error('fetch must not be called'); });
  assert.equal(code, 1);
  assert.match(readFileSync(summary, 'utf8'), /agentgate: BLOCK/);
  assert.match(readFileSync(output, 'utf8'), /verdict=block/);
});

test('run(): self-applied label keeps block and says why', async () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('tests/a.test.ts', 'it.skip("y", () => {});\n'); const head = r.commit('h');
  const { env: e, summary, output } = env(r.dir, prEvent(base, head, [L], 'dev'));
  const fetchFn = (async () => new Response(JSON.stringify([ev('dev', 'User')]), { status: 200 })) as unknown as typeof fetch;
  const code = await run(e, fetchFn);
  assert.equal(code, 1);
  assert.match(readFileSync(summary, 'utf8'), /Override label ignored: applied by the PR author/);
  assert.match(readFileSync(output, 'utf8'), /verdict=block/);
});

test('run(): human override downgrades to warn', async () => {
  const r = makeRepo(); r.write('a', 'a\n'); const base = r.commit('b');
  r.write('tests/a.test.ts', 'it.skip("y", () => {});\n'); const head = r.commit('h');
  const { env: e, summary, output } = env(r.dir, prEvent(base, head, [L], 'bot[bot]'));
  const fetchFn = (async () => new Response(JSON.stringify([ev('piyush97', 'User')]), { status: 200 })) as unknown as typeof fetch;
  const code = await run(e, fetchFn);
  assert.equal(code, 0);
  assert.match(readFileSync(summary, 'utf8'), /Override by @piyush97 via label agentgate-approved/);
  assert.match(readFileSync(output, 'utf8'), /verdict=warn/);
});
