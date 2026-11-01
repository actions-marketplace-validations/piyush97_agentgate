# Contributing

Requires Node 24.2+.

```bash
npm ci
npm run typecheck
npm test
npm run build   # commit dist/; CI fails on stale dist/
```

- No runtime dependencies. Rules stay pure: `(files, ctx) => Finding[]`.
- Every rule change ships with a test in `tests/rules/`.
- Fail closed: bad input or missing data exits 2, never passes.
- See [docs/architecture.md](docs/architecture.md) before changing the pipeline.

PRs that touch `.github/**`, `.agentgate.json`, or tests are gated by agentgate itself and need a code owner label approval.

## Releasing

1. Bump `version` in `package.json` and move `CHANGELOG.md` entries under the new version.
2. `npm run build`, commit, merge to the default branch.
3. Tag and release: `git tag v0.1.0 && git push origin v0.1.0 && gh release create v0.1.0 --generate-notes`.
4. Update the README Quick start with the full release commit SHA.
