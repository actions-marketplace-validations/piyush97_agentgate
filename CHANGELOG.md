# Changelog

## 0.1.2 (2026-11-21)

- `test-weakened` now flags xUnit skip markers: `[ActiveIssue(...)]` and `Skip =` on `[Fact]`/`[Theory]`. Found in a field trial where a .NET test disabled this way passed the gate.
- Add `docs/field-trial.md`, a run of agentgate against six merged AI-agent PRs.

## 0.1.1 (2026-11-07)

- Explain blocking findings, fixes and override steps in reports.
- Let the repository owner approve their own PR with the configured override label. Other authors cannot self-approve; bot approvals remain rejected.
- Change the action display name to `Agentgate by piyush97` to avoid the GitHub Marketplace name collision. Repository and CLI names are unchanged.

## 0.1.0 (2026-11-01)

- Rules: `test-weakened`, `guardrail-edited`, `workflow-escalation`, `dependency-added`, `suppression-added`.
- `agentgate check` CLI with Markdown and JSON output.
- GitHub Action with step summary, annotations, `verdict` output, and human-only label override.
- Config read from the PR base commit; append-only `protectedPaths`.
