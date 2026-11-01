import type { DiffLine, FileDiff } from '../../src/types.ts';

type Lines = Array<string | [number, string]>;

const toLines = (xs: Lines | undefined): DiffLine[] =>
  (xs ?? []).map((x, i) => (typeof x === 'string' ? { line: i + 1, text: x } : { line: x[0], text: x[1] }));

export function fd(
  path: string,
  o: {
    status?: FileDiff['status'];
    oldPath?: string;
    binary?: boolean;
    added?: Lines;
    removed?: Lines;
  } = {},
): FileDiff {
  return {
    path,
    oldPath: o.oldPath ?? null,
    status: o.status ?? 'modified',
    binary: o.binary ?? false,
    added: toLines(o.added),
    removed: toLines(o.removed),
  };
}
