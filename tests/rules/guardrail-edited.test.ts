import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../../src/config.ts';
import { guardrailEdited } from '../../src/rules/guardrail-edited.ts';
import { fd } from '../helpers/fd.ts';

test('guardrail: CODEOWNERS, workflow, config, nested AGENTS.md, user path, rename from protected path', () => {
  const ctx = { config: parseConfig('{"protectedPaths":["src/monitoring/**"]}', 't'), readFile: () => null };
  const out = guardrailEdited.check([fd('.github/CODEOWNERS'), fd('.github/workflows/ci.yml'), fd('.agentgate.json'),
    fd('packages/api/AGENTS.md'), fd('src/monitoring/alerts.ts'), fd('src/x.ts', { status: 'renamed', oldPath: '.github/workflows/gate.yml' }), fd('src/app.ts')], ctx);
  assert.deepEqual(out.map((f) => f.file), ['.github/CODEOWNERS', '.github/workflows/ci.yml', '.agentgate.json',
    'packages/api/AGENTS.md', 'src/monitoring/alerts.ts', 'src/x.ts']);
});
