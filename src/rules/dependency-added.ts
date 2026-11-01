import { matchesGlob } from 'node:path';
import type { FileDiff, RawFinding, Rule, RuleContext } from '../types.ts';

const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;
const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare'];

type Json = Record<string, unknown>;

function parseJson(text: string | null): Json | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
  } catch {
    return null;
  }
}

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

function packageJson(f: FileDiff, ctx: RuleContext): RawFinding[] {
  const headText = ctx.readFile('head', f.path);
  if (headText === null) return [];
  const head = parseJson(headText);
  if (head === null) return [{ rule: 'dependency-added', file: f.path, message: 'package.json is not valid JSON' }];

  const base = parseJson(ctx.readFile('base', f.oldPath ?? f.path)) ?? {};
  const findings: RawFinding[] = [];

  for (const field of DEP_FIELDS) {
    const before = asObject(base[field]);
    for (const [name, range] of Object.entries(asObject(head[field]))) {
      if (!Object.hasOwn(before, name)) {
        findings.push({ rule: 'dependency-added', file: f.path, message: `New dependency: ${name}@${String(range)} (${field})` });
      }
    }
  }

  const beforeScripts = asObject(base['scripts']);
  for (const [name, command] of Object.entries(asObject(head['scripts']))) {
    if (LIFECYCLE.includes(name) && typeof command === 'string' && beforeScripts[name] !== command) {
      findings.push({ rule: 'dependency-added', file: f.path, message: `Install lifecycle script changed: ${name}` });
    }
  }

  return findings;
}

const nameOf = (text: string): string => text.split(/[=<>~![; ]/, 1)[0]!.toLowerCase();

function requirements(f: FileDiff): RawFinding[] {
  const before = new Set(f.removed.map((l) => nameOf(l.text.split('#')[0]!.trim())).filter((n) => n !== ''));
  const findings: RawFinding[] = [];

  for (const line of f.added) {
    const text = line.text.split('#')[0]!.trim();
    if (text === '' || text.startsWith('-')) continue;
    if (before.has(nameOf(text))) continue;
    findings.push({ rule: 'dependency-added', file: f.path, line: line.line, message: `New dependency: ${text}` });
  }

  return findings;
}

export const dependencyAdded: Rule = {
  id: 'dependency-added',

  check(files: FileDiff[], ctx: RuleContext): RawFinding[] {
    const findings: RawFinding[] = [];
    for (const f of files) {
      if (f.status === 'deleted') continue;
      if (matchesGlob(f.path, '**/package.json')) findings.push(...packageJson(f, ctx));
      if (matchesGlob(f.path, '**/requirements*.txt')) {
        if (f.binary) findings.push({ rule: 'dependency-added', file: f.path, message: 'Dependency file changed as binary: needs human review' });
        else findings.push(...requirements(f));
      }
    }
    return findings;
  },
};
