import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAnnotations, toJson, toMarkdown } from '../src/report.ts';

test('annotations escape newlines and property separators', () => {
  const [a] = toAnnotations([{ rule: 'suppression-added', severity: 'warn', file: 'a,b:c.ts', line: 2, message: 'x\ny%' }]);
  assert.equal(a, '::warning file=a%2Cb%3Ac.ts,line=2,title=agentgate/suppression-added::x%0Ay%25');
});
test('markdown escapes pipes and shows note', () => {
  const md = toMarkdown([{ rule: 'test-weakened', severity: 'block', file: 't.ts', line: 1, message: 'a | b' }], 'block', 'Override label ignored: x');
  assert.match(md, /a \\\| b/); assert.match(md, /Override label ignored: x/);
});
test('markdown and json for a clean run', () => {
  assert.match(toMarkdown([], 'pass'), /No findings\./);
  assert.deepEqual(JSON.parse(toJson([], 'pass')), { verdict: 'pass', findings: [] });
});
