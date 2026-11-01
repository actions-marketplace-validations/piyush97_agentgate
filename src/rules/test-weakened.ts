import { matchesGlob } from 'node:path';
import type { FileDiff, RawFinding, Rule, RuleContext } from '../types.ts';

const SKIP = /\b(?:it|test|describe)\.(?:skip|only|todo)\s*\(|^\b(?:xit|xtest|xdescribe)\s*\(|@pytest\.mark\.(?:skip|xfail)|@unittest\.skip|\bt\.Skip(?:Now|f)?\s*\(|@Disabled\b|@Ignore\b/;
const ASSERT = /\b(?:expect|assert\w*)\s*[.(]|\bself\.assert\w+\s*\(|\bt\.(?:Error|Errorf|Fatal|Fatalf|Fail|FailNow)\s*\(|\brequire\.\w+\s*\(/;

export function isTestPath(path: string, globs: string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}

export const testWeakened: Rule = {
  id: 'test-weakened',

  check(files: FileDiff[], ctx: RuleContext): RawFinding[] {
    const findings: RawFinding[] = [];
    const isTest = (p: string | null): boolean => p !== null && isTestPath(p, ctx.config.testGlobs);

    for (const f of files) {
      if (f.status === 'deleted' && isTest(f.path)) {
        findings.push({ rule: 'test-weakened', file: f.path, message: 'Test file deleted' });
      }
    }

    for (const f of files) {
      if (f.status === 'renamed' && isTest(f.oldPath) && !isTest(f.path)) {
        findings.push({
          rule: 'test-weakened',
          file: f.path,
          message: `Test file moved out of test paths: ${f.oldPath} → ${f.path}`,
        });
      }
    }

    for (const f of files) {
      if (!isTest(f.path)) continue;
      for (const line of f.added) {
        if (SKIP.test(line.text)) {
          findings.push({
            rule: 'test-weakened',
            file: f.path,
            line: line.line,
            message: `Test disabled or focused: ${line.text.trim()}`,
          });
        }
      }
    }

    let net = 0;
    let worst: { file: string; loss: number } | null = null;
    for (const f of files) {
      if (!isTest(f.path) || f.status === 'deleted') continue;
      const added = f.added.filter((l) => ASSERT.test(l.text)).length;
      const removed = f.removed.filter((l) => ASSERT.test(l.text)).length;
      net += added - removed;
      const loss = removed - added;
      if (loss > 0 && (worst === null || loss > worst.loss)) worst = { file: f.path, loss };
    }
    if (net < 0 && worst !== null) {
      findings.push({
        rule: 'test-weakened',
        file: worst.file,
        message: `Net ${-net} assertion(s) removed across test files`,
      });
    }

    return findings;
  },
};
