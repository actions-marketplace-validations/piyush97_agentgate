import type { Finding } from './types.ts';
import type { Verdict } from './engine.ts';

const cell = (text: string): string => text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

export function toMarkdown(findings: Finding[], verdict: Verdict, note?: string): string {
  const lines = [`## agentgate: ${verdict.toUpperCase()}`, ''];
  if (note) lines.push(note, '');

  if (findings.length === 0) {
    lines.push('No findings.');
    return lines.join('\n');
  }

  lines.push('| Severity | Rule | Location | Finding |', '| --- | --- | --- | --- |');
  for (const f of findings) {
    const location = f.line === undefined ? f.file : `${f.file}:${f.line}`;
    lines.push(`| ${f.severity} | ${cell(f.rule)} | ${cell(location)} | ${cell(f.message)} |`);
  }
  return lines.join('\n');
}

export function toJson(findings: Finding[], verdict: Verdict): string {
  return JSON.stringify({ verdict, findings }, null, 2);
}

const escapeData = (text: string): string =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const escapeProperty = (text: string): string =>
  escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

export function toAnnotations(findings: Finding[]): string[] {
  return findings.map((f) => {
    const level = f.severity === 'block' ? 'error' : 'warning';
    const props = [`file=${escapeProperty(f.file)}`];
    if (f.line !== undefined) props.push(`line=${f.line}`);
    props.push(`title=${escapeProperty(`agentgate/${f.rule}`)}`);
    return `::${level} ${props.join(',')}::${escapeData(f.message)}`;
  });
}
