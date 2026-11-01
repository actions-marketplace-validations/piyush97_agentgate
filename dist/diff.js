const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
export function parseHunks(patch) {
    const binary = /^Binary files .* differ$/m.test(patch);
    const added = [];
    const removed = [];
    let inHunk = false;
    let oldLine = 0;
    let newLine = 0;
    for (const raw of patch.split('\n')) {
        if (raw.startsWith('diff --git')) {
            inHunk = false;
            continue;
        }
        const m = HUNK.exec(raw);
        if (m) {
            oldLine = Number(m[1]);
            newLine = Number(m[2]);
            inHunk = true;
            continue;
        }
        if (!inHunk)
            continue;
        if (raw.startsWith('\\'))
            continue;
        const tag = raw[0];
        if (tag === '-') {
            removed.push({ line: oldLine++, text: raw.slice(1) });
        }
        else if (tag === '+') {
            added.push({ line: newLine++, text: raw.slice(1) });
        }
        else if (tag === ' ') {
            oldLine++;
            newLine++;
        }
    }
    return { binary, added, removed };
}
