# agentgate

Block AI-agent PRs that weaken tests, edit guardrails, or escalate CI permissions.

Semgrep and gitleaks catch insecure code. They do not catch a PR that deletes the failing test, loosens the workflow permissions, or silences the scanner. agentgate checks that layer: it reads the PR diff, applies five rules, and fails the check when the change needs a human.

## Rules

| Rule | Blocks when | Default |
| --- | --- | --- |
| `test-weakened` | a test file is deleted or moved out of test paths, a test is skipped or focused, or the PR removes more assertions than it adds | block |
| `guardrail-edited` | the PR touches `.github/**`, `CODEOWNERS`, `AGENTS.md`, `.agentgate.json`, scanner configs, or paths you add | block |
| `workflow-escalation` | a workflow gains `pull_request_target`, `write-all`, a `write` permission, a secret, untrusted `github.event` interpolation, or an action not pinned to a full commit SHA | block |
| `dependency-added` | `package.json` or `requirements*.txt` gains a dependency, or an install lifecycle script changes | warn |
| `suppression-added` | a changed line silences a scanner or the type checker (`nosemgrep`, `eslint-disable`, `@ts-ignore`, `noqa`, `NOSONAR`, ...) | warn |

Two rules already have coverage elsewhere: a changed test still has to pass CI, so a weakened test usually only shows up when the assertion it replaced disappears; that is what `test-weakened` measures.

## Quick start

```yaml
# .github/workflows/agentgate.yml
on: pull_request
permissions:
  contents: read
  pull-requests: read
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: piyush97/agentgate@v0
```

`fetch-depth: 0` is required: the Action resolves the PR base commit to read config and file contents from it.

Locally, against the last three commits:

```bash
npx @piyush97/agentgate check --base HEAD~3
```

## Config

`.agentgate.json` at the repository root. It is read from the PR **base** commit, so a PR cannot turn rules off in the same change that violates them.

```json
{
  "testGlobs": ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/test/**", "**/tests/**", "**/*_test.go", "**/test_*.py", "**/*_test.py"],
  "protectedPaths": [".github/**", "**/CODEOWNERS", ".agentgate.json", "**/AGENTS.md", "**/CLAUDE.md", ".cursor/**", ".semgrepignore", ".semgrep.yml", ".gitleaks.toml", ".gitleaksignore", "**/.npmrc"],
  "overrideLabel": "agentgate-approved",
  "rules": {
    "test-weakened": "block",
    "guardrail-edited": "block",
    "workflow-escalation": "block",
    "dependency-added": "warn",
    "suppression-added": "warn"
  }
}
```

- `protectedPaths` is **append-only**: your entries are added to the defaults. You cannot drop `.agentgate.json` or `.github/**`.
- `testGlobs` and `overrideLabel` replace the defaults.
- `rules` merges per rule; values are `block`, `warn`, or `off`.
- Unknown keys, unknown rules, and bad severities fail the run with exit 2 instead of being ignored.

## Override

A reviewer who has read the change can apply the `agentgate-approved` label. The block becomes a warning, and the step summary names who approved it.

The label only counts when:

- the latest `labeled` or `unlabeled` event for it is a `labeled` event,
- the actor is a user account, not a bot,
- the actor is not the PR author.

Anything else keeps the block and says why in the summary. The Action has `contents: read` and `pull-requests: read`; it never writes to the PR.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | pass or warn |
| 1 | block |
| 2 | usage or environment error (missing base commit, bad config) |

Exit 2 is deliberate: a shallow clone fails loudly instead of passing.

## What it does not catch

This gate reads diffs, not behavior. It cannot see authorization bugs, IDOR, tenant isolation breaks, or business-logic errors, and an agent that writes a plausible test for wrong behavior passes every rule here. Keep SAST, secret scanning, and human review of the risky paths.

Background and the threat model: [AI Coding Agents Pass Tests, Ship Insecure Code](https://piyushmehta.com/blog/ai-coding-agent-security-gate).

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build   # dist/ is committed for the Action; CI fails on stale dist/
```

MIT licensed.
