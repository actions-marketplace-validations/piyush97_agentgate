const SUPPRESSION = /\bnosemgrep\b|eslint-disable|@ts-(?:ignore|nocheck|expect-error)|#\s*noqa\b|#\s*type:\s*ignore|gitleaks:allow|\bNOSONAR\b|#\s*nosec\b|\/\/\s*nolint\b|(?:istanbul|c8|v8)\s+ignore|pragma:\s*allowlist\s+secret/;
export const suppressionAdded = {
    id: 'suppression-added',
    check(files, _ctx) {
        const findings = [];
        for (const f of files) {
            if (f.binary)
                continue;
            for (const line of f.added) {
                if (!SUPPRESSION.test(line.text))
                    continue;
                findings.push({
                    rule: 'suppression-added',
                    file: f.path,
                    line: line.line,
                    message: `Scanner or type check silenced: ${line.text.trim().slice(0, 120)}`,
                });
            }
        }
        return findings;
    },
};
