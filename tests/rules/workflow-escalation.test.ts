import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/config.ts';
import { workflowEscalation } from '../../src/rules/workflow-escalation.ts';
import { fd } from '../helpers/fd.ts';

test('workflow escalation patterns', () => {
  const ctx = { config: DEFAULT_CONFIG, readFile: () => null };
  const out = workflowEscalation.check([fd('.github/workflows/ci.yml', { added: [
    [3, 'on: pull_request_target'], [6, '  contents: write'], [9, '      TOKEN: ${{ secrets.NPM_TOKEN }}'],
    [12, '        run: echo "${{ github.event.pull_request.title }}"'], [15, '      - uses: actions/checkout@v5'],
    [16, '      - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8'], [17, '      - uses: ./.github/actions/local'],
    [18, '  contents: read'] ] })], ctx);
  assert.deepEqual(out.map((f) => f.line), [3, 6, 9, 12, 15]);
});

test('workflow rule ignores non-workflow files and removed lines', () => {
  const ctx = { config: DEFAULT_CONFIG, readFile: () => null };
  assert.deepEqual(workflowEscalation.check([fd('docs/ci.md', { added: ['contents: write'] }),
    fd('.github/workflows/ci.yml', { removed: ['contents: write'] })], ctx), []);
});

test('a SHA prefix followed by a branch suffix is not an immutable pin', () => {
  const ctx = { config: DEFAULT_CONFIG, readFile: () => null };
  const out = workflowEscalation.check([fd('.github/workflows/ci.yml', { added: [
    [1, '  - uses: owner/action@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-branch'],
    [2, '  - uses: owner/action@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # pinned'],
  ] })], ctx);
  assert.deepEqual(out.map(f => f.line), [1]);
});
