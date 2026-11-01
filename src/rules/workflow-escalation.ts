import type { FileDiff, RawFinding, Rule, RuleContext } from '../types.ts';

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;

const PATTERNS: Array<[RegExp, string]> = [
  [/\bpull_request_target\b/, 'pull_request_target runs with a write token and secrets'],
  [/permissions:\s*write-all/, 'write-all permissions'],
  [/^\s*(?:contents|id-token|actions|packages|pull-requests|issues|deployments|security-events|statuses|checks|attestations):\s*write\b/, 'write permission granted'],
  [/\$\{\{\s*secrets\./, 'secret referenced'],
  [/\$\{\{\s*github\.(?:head_ref|event\.[\w.]*\.(?:title|body|ref|label|name|email|message))\b/, 'untrusted input interpolated into workflow'],
  [/^\s*-?\s*uses:\s*(?!\.\/|docker:\/\/)[^@\s#]+@(?![0-9a-f]{40}(?:\s|$))\S+/, 'action not pinned to a full commit SHA'],
];

export const workflowEscalation: Rule = {
  id: 'workflow-escalation',

  check(files: FileDiff[], _ctx: RuleContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const f of files) {
      if (!WORKFLOW.test(f.path)) continue;
      for (const line of f.added) {
        const hit = PATTERNS.find(([pattern]) => pattern.test(line.text));
        if (hit) {
          findings.push({ rule: 'workflow-escalation', file: f.path, line: line.line, message: hit[1] });
        }
      }
    }

    return findings;
  },
};
