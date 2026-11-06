import type { Finding } from './types.ts';
import type { Verdict } from './engine.ts';

const cell = (text: string): string => text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

export function toMarkdown(
  findings: Finding[],
  verdict: Verdict,
  note?: string,
  overrideLabel = 'agentgate-approved',
): string {
  const lines = [`## agentgate: ${verdict.toUpperCase()}`, ''];

  if (verdict === 'pass') {
    lines.push('No findings.');
    return lines.join('\n');
  }

  const blocking = findings.filter((f) => f.severity === 'block').length;
  const files = new Set(findings.map((f) => f.file)).size;
  lines.push(
    verdict === 'block'
      ? `${blocking} of ${findings.length} finding(s) in ${files} file(s) block this PR.`
      : `${findings.length} warning(s) in ${files} file(s). Nothing blocks this PR.`,
    '',
  );
  if (note) lines.push(note, '');

  lines.push('| Severity | Rule | Location | Finding |', '| --- | --- | --- | --- |');
  for (const f of findings) {
    const location = f.line === undefined ? f.file : `${f.file}:${f.line}`;
    lines.push(`| ${f.severity} | ${cell(f.rule)} | ${cell(location)} | ${cell(f.message)} |`);
  }

  if (verdict === 'block') {
    lines.push(
      '',
      '### How to unblock',
      '',
      '- Fix the blocking findings and push again.',
      `- Or have a human with write access who did not author this PR apply the \`${overrideLabel}\` label: it turns block into warn and records who approved. The repo owner can approve their own PR.`,
      '- Re-apply the label after new commits. An existing label never approves a new push.',
    );
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
