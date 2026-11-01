import type { Git } from './git.ts';
import { GateError } from './types.ts';
import type { Config, RuleId, Severity } from './types.ts';

export const DEFAULT_CONFIG: Config = {
  testGlobs: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/test/**',
    '**/tests/**',
    '**/*_test.go',
    '**/test_*.py',
    '**/*_test.py',
  ],
  protectedPaths: [
    '.github/**',
    '**/CODEOWNERS',
    '.agentgate.json',
    '**/AGENTS.md',
    '**/CLAUDE.md',
    '.cursor/**',
    '.semgrepignore',
    '.semgrep.yml',
    '.gitleaks.toml',
    '.gitleaksignore',
    '**/.npmrc',
  ],
  overrideLabel: 'agentgate-approved',
  rules: {
    'test-weakened': 'block',
    'guardrail-edited': 'block',
    'workflow-escalation': 'block',
    'dependency-added': 'warn',
    'suppression-added': 'warn',
  },
};

const RULE_IDS = Object.keys(DEFAULT_CONFIG.rules) as RuleId[];
const SEVERITIES: Array<Severity | 'off'> = ['block', 'warn', 'off'];
const TOP_LEVEL = ['testGlobs', 'protectedPaths', 'overrideLabel', 'rules'];

function fail(source: string, detail: string): never {
  throw new GateError(`Invalid config in ${source}: ${detail}`);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.length > 0);
}

export function parseConfig(json: string, source: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    fail(source, `not valid JSON (${(e as Error).message})`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail(source, 'expected a JSON object');

  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL.includes(key)) fail(source, `unknown key "${key}"`);
  }

  const config: Config = {
    ...DEFAULT_CONFIG,
    testGlobs: [...DEFAULT_CONFIG.testGlobs],
    protectedPaths: [...DEFAULT_CONFIG.protectedPaths],
    rules: { ...DEFAULT_CONFIG.rules },
  };

  if ('testGlobs' in input) {
    if (!isStringArray(input.testGlobs)) fail(source, '"testGlobs" must be an array of glob strings');
    config.testGlobs = [...input.testGlobs];
  }

  if ('protectedPaths' in input) {
    if (!isStringArray(input.protectedPaths)) fail(source, '"protectedPaths" must be an array of glob strings');
    config.protectedPaths = [...DEFAULT_CONFIG.protectedPaths, ...input.protectedPaths];
  }

  if ('overrideLabel' in input) {
    if (typeof input.overrideLabel !== 'string' || input.overrideLabel === '') {
      fail(source, '"overrideLabel" must be a non-empty string');
    }
    config.overrideLabel = input.overrideLabel;
  }

  if ('rules' in input) {
    const rules = input.rules;
    if (typeof rules !== 'object' || rules === null || Array.isArray(rules)) fail(source, '"rules" must be an object');
    for (const [id, severity] of Object.entries(rules as Record<string, unknown>)) {
      if (!RULE_IDS.includes(id as RuleId)) fail(source, `unknown rule "${id}"`);
      if (!SEVERITIES.includes(severity as Severity | 'off')) fail(source, `invalid severity for "${id}"`);
      config.rules[id as RuleId] = severity as Severity | 'off';
    }
  }

  return config;
}

export function loadConfig(git: Git, baseSha: string, path = '.agentgate.json'): Config {
  const text = git.show(baseSha, path);
  if (text === null) return { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules } };
  return parseConfig(text, `${path}@${baseSha.slice(0, 7)}`);
}
