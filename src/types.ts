export type Severity = 'block' | 'warn';
export type RuleId =
  | 'test-weakened'
  | 'guardrail-edited'
  | 'workflow-escalation'
  | 'dependency-added'
  | 'suppression-added';

export interface DiffLine {
  line: number;
  text: string;
}

export interface FileDiff {
  path: string;
  oldPath: string | null;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  binary: boolean;
  added: DiffLine[];
  removed: DiffLine[];
}

export interface RawFinding {
  rule: RuleId;
  file: string;
  line?: number;
  message: string;
}

export interface Finding extends RawFinding {
  severity: Severity;
}

export interface Config {
  testGlobs: string[];
  protectedPaths: string[];
  overrideLabel: string;
  rules: Record<RuleId, Severity | 'off'>;
}

export interface RuleContext {
  config: Config;
  readFile(ref: 'base' | 'head', path: string): string | null;
}

export interface Rule {
  id: RuleId;
  check(files: FileDiff[], ctx: RuleContext): RawFinding[];
}

export class GateError extends Error {}
