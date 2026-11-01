import { matchesGlob } from 'node:path';
export const guardrailEdited = {
    id: 'guardrail-edited',
    check(files, ctx) {
        const findings = [];
        const protectedMatch = (p) => p !== null && ctx.config.protectedPaths.some((glob) => matchesGlob(p, glob));
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
