import { loadConfig } from './config.ts';
import { createGit } from './git.ts';
import type { FileDiff, RuleContext } from './types.ts';

export function collect(
  cwd: string,
  base: string,
  head: string,
  configPath?: string,
): { files: FileDiff[]; ctx: RuleContext; baseSha: string; headSha: string } {
  const git = createGit(cwd);
  const baseSha = git.resolve(base);
  const headSha = git.resolve(head);
  const config = loadConfig(git, baseSha, configPath);
  const ctx: RuleContext = {
    config,
    readFile: (ref, path) => git.show(ref === 'base' ? baseSha : headSha, path),
  };
  return { files: git.changes(baseSha, headSha), ctx, baseSha, headSha };
}
