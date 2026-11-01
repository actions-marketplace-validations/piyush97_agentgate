import { ALL_RULES } from './rules/index.js';
export function runGate(files, ctx) {
    const findings = [];
    for (const rule of ALL_RULES) {
        const severity = ctx.config.rules[rule.id];
        if (severity === 'off')
            continue;
        for (const finding of rule.check(files, ctx)) {
            findings.push({ ...finding, severity: severity });
        }
    }
    return findings;
}
export function verdictOf(findings) {
    if (findings.some((f) => f.severity === 'block'))
        return 'block';
    if (findings.length > 0)
        return 'warn';
    return 'pass';
}
export function downgrade(findings) {
    return findings.map((f) => (f.severity === 'block' ? { ...f, severity: 'warn' } : f));
}
