import { execFileSync } from 'node:child_process';
import { parseHunks } from "./diff.js";
import { GateError } from "./types.js";
export function createGit(cwd) {
    const run = (args) => {
        try {
            return execFileSync('git', ['--literal-pathspecs', ...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
        }
        catch {
            throw new GateError('Cannot read repository history. Use actions/checkout with fetch-depth: 0.');
        }
    };
    cwd = run(['rev-parse', '--show-toplevel']).trim();
    return {
        resolve(ref) {
            try {
                return run(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
            }
            catch {
                throw new GateError(`Cannot find commit ${ref}. Use actions/checkout with fetch-depth: 0.`);
            }
        },
        changes(base, head) {
            const range = `${base}...${head}`;
            const tokens = run(['-c', 'core.quotePath=false', 'diff', '--name-status', '-z', '-M', range])
                .split('\0')
                .filter((t) => t !== '');
            const files = [];
            for (let i = 0; i < tokens.length;) {
                const kind = tokens[i++][0];
                if (kind === 'R' || kind === 'C') {
                    const oldPath = tokens[i++];
                    const path = tokens[i++];
                    files.push({ path, oldPath, status: 'renamed', binary: false, added: [], removed: [] });
                }
                else {
                    const path = tokens[i++];
                    const status = kind === 'A' ? 'added' : kind === 'D' ? 'deleted' : 'modified';
                    files.push({ path, oldPath: null, status, binary: false, added: [], removed: [] });
                }
            }
            for (const f of files) {
                const spec = f.oldPath ? [f.oldPath, f.path] : [f.path];
                const patch = run(['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--unified=0', '-M', range, '--', ...spec]);
                const parsed = parseHunks(patch);
                f.binary = parsed.binary;
                f.added = parsed.added;
                f.removed = parsed.removed;
            }
            return files;
        },
        show(ref, path) {
            if (run(['ls-tree', '-z', ref, '--', path]) === '')
                return null;
            return run(['show', `${ref}:${path}`]);
        },
    };
}
