import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface TempRepo {
  dir: string;
  write(path: string, content: string | Buffer): void;
  rm(path: string): void;
  commit(msg: string): string;
  git(...args: string[]): string;
}

export function makeRepo(): TempRepo {
  const dir = mkdtempSync(join(tmpdir(), 'agentgate-'));
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');

  return {
    dir,
    git,
    write(path, content) {
      const full = join(dir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    },
    rm(path) {
      rmSync(join(dir, path), { recursive: true, force: true });
    },
    commit(msg) {
      git('add', '-A');
      git('commit', '-qm', msg);
      return git('rev-parse', 'HEAD').trim();
    },
  };
}
