import { matchesGlob } from 'node:path';
import type { FileDiff, RawFinding, Rule, RuleContext } from '../types.ts';

export const guardrailEdited: Rule = {
  id: 'guardrail-edited',

  check(files: FileDiff[], ctx: RuleContext): RawFinding[] {
    const findings: RawFinding[] = [];
    const protectedMatch = (p: string | null): boolean =>
      p !== null && ctx.config.protectedPaths.some((glob) => matchesGlob(p, glob));

    for (const f of files) {
      if (protectedMatch(f.path) || protectedMatch(f.oldPath)) {
        findings.push({
          rule: 'guardrail-edited',
          file: f.path,
          message: `Protected path changed (${f.status}): needs human review`,
        });
      }
    }

    return findings;
  },
};
