import { ALL_RULES } from './rules/index.ts';
import type { FileDiff, Finding, RuleContext, Severity } from './types.ts';

export type Verdict = 'pass' | 'warn' | 'block';

export function runGate(files: FileDiff[], ctx: RuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const rule of ALL_RULES) {
    const severity = ctx.config.rules[rule.id];
    if (severity === 'off') continue;
    for (const finding of rule.check(files, ctx)) {
      findings.push({ ...finding, severity: severity as Severity });
    }
  }
  return findings;
}

export function verdictOf(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === 'block')) return 'block';
  if (findings.length > 0) return 'warn';
  return 'pass';
}

export function downgrade(findings: Finding[]): Finding[] {
  return findings.map((f) => (f.severity === 'block' ? { ...f, severity: 'warn' as Severity } : f));
}
