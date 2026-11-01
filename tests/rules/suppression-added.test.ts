import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/config.ts';
import { suppressionAdded } from '../../src/rules/suppression-added.ts';
import { fd } from '../helpers/fd.ts';

const ctx = { config: DEFAULT_CONFIG, readFile: () => null };

test('suppressions flagged by line; binary skipped', () => {
  const out = suppressionAdded.check([fd('src/a.ts', { added: [[4, '// @ts-ignore'], [5, 'const ok = 1;'], [8, 'q = sql(x)  # nosemgrep']] }),
    fd('img.png', { binary: true })], ctx);
  assert.deepEqual(out.map((f) => f.line), [4, 8]);
});
