import { loadConfig } from './config.js';
import { createGit } from './git.js';
export function collect(cwd, base, head, configPath) {
    const git = createGit(cwd);
    const baseSha = git.resolve(base);
    const headSha = git.resolve(head);
    const config = loadConfig(git, baseSha, configPath);
    const ctx = {
        config,
        readFile: (ref, path) => git.show(ref === 'base' ? baseSha : headSha, path),
    };
    return { files: git.changes(baseSha, headSha), ctx, baseSha, headSha };
}
