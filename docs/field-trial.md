# Field trial: merged AI-agent PRs

Run date: 2026-11-20. agentgate v0.1.1 (`a940c23`, the released `dist/`), default config (none of these repos has `.agentgate.json`).

Six merged PRs from public repositories, each authored by an AI coding agent (GitHub Copilot coding agent or Devin). Every verdict below is the CLI output, copied, not edited.

## Method

Each PR was squash- or merge-committed, so the merge commit's first parent is the base and the merge commit is the head. The CLI sees the same net diff the PR introduced.

```bash
git init -q repo && cd repo
git remote add origin https://github.com/<owner>/<repo>.git
git fetch -q --filter=blob:none --depth=2 origin <merge-sha>
node /path/to/agentgate/dist/cli.js check --base <merge-sha>^1 --head <merge-sha> --format json
```

## Results (v0.1.1)

| Repo | PR | Agent | Verdict | Rules fired |
| --- | --- | --- | --- | --- |
| BerriAI/litellm | [#33129](https://github.com/BerriAI/litellm/pull/33129) fix(websearch): intercept web search on the Responses API | Devin | pass | none |
| expo/orbit | [#405](https://github.com/expo/orbit/pull/405) [cli] Fix getCurrentLauncher test on Windows | Devin | pass | none |
| VapiAI/gitops | [#105](https://github.com/VapiAI/gitops/pull/105) Add @biomejs/biome as a dev dependency | Devin | block | `guardrail-edited` (block, `AGENTS.md`), `dependency-added` (warn, `@biomejs/biome@2.4.15` in devDependencies) |
| dotnet/runtime | [#137001](https://github.com/dotnet/runtime/pull/137001) Enable NativeAOT WASI smoke test execution on Helix | Copilot | pass | none |
| microsoft/vscode | [#347186](https://github.com/microsoft/vscode/pull/347186) Add coverage for hooks-only plugin discovery and Local inventory refresh | Copilot | pass | none |
| microsoft/typescript-go | [#4881](https://github.com/microsoft/typescript-go/pull/4881) Fix TS1515 not reported when duplicate named group is nested inside a group | Copilot | pass | none |

## Notes per PR

- **litellm #33129**: adds a handler and a 318-line test file. Nothing removed from tests. Pass is correct.
- **orbit #405**: rewrites one `expect(...)` into a multi-line `expect(...)`. One assertion removed, one added, net zero, so no finding. Pass is correct: the test still asserts the same value, now via `path.resolve`.
- **gitops #105**: the `AGENTS.md` edit is two lines telling agents to run `npx biome check`. The content is harmless, but an agent editing its own instructions file is exactly what `guardrail-edited` exists to route to a human. Block is policy-correct, not a false positive. The dependency warning is accurate.
- **dotnet/runtime #137001**: **false negative.** `src/tests/nativeaot/SmokeTests/UnitTests/StackTraces.cs` wraps `TestLineNumbers.Run();` in `if (RuntimeInformation.ProcessArchitecture != Architecture.Wasm)` under a `// ActiveIssue https://github.com/dotnet/runtime/issues/136676` comment. That disables a test on one platform. `test-weakened` knew JS, Python, Go and Java skip markers but no .NET ones, so it passed. Fixed below.
  The PR also edits `eng/pipelines/runtime.yml` (Azure Pipelines CI). The default `protectedPaths` only covers `.github/**`, so this is not flagged. That is a config gap, not a rule bug: repos on Azure Pipelines should add `eng/pipelines/**` to `protectedPaths`.
- **vscode #347186**: test-only PR that adds assertions. Pass is correct.
- **typescript-go #4881**: scanner fix plus new test case and baselines. Pass is correct.

## Bug fixed from this trial

`test-weakened` now matches xUnit skip markers: `ActiveIssue` (attribute or the dotnet/runtime comment convention) and `Skip =` inside `[Fact(...)]` / `[Theory(...)]`. Regression test: `xUnit ActiveIssue and Skip= flagged (dotnet/runtime#137001 field trial)` in `tests/rules/test-weakened.test.ts`.

Re-run of dotnet/runtime #137001 with the fix:

```json
{
  "verdict": "block",
  "findings": [
    {
      "rule": "test-weakened",
      "file": "src/tests/nativeaot/SmokeTests/UnitTests/StackTraces.cs",
      "line": 18,
      "message": "Test disabled or focused (// ActiveIssue https://github.com/dotnet/runtime/issues/136676): remove the marker, or have a reviewer apply \"agentgate-approved\".",
      "severity": "block"
    }
  ]
}
```

The other five verdicts did not change.

## Known gap, fixed after the trial

The assertion counter was case-sensitive, so C# assertions (`Assert.Equal(...)`, `Assert.True(...)`) were not counted. A PR that deleted xUnit/NUnit/MSTest assertions would not trip the net-assertion-loss check. None of the six PRs removed such lines, so this trial did not produce a false negative from it.

The counter now also counts `Assert.*`, `CollectionAssert.*` and `StringAssert.*` calls (C#), Rust `assert!`/`assert_eq!`/`debug_assert!` style macros, and GoogleTest `EXPECT_*`/`ASSERT_*` macros. Regression test: `C#, Rust and GoogleTest assertions count toward net assertion loss` in `tests/rules/test-weakened.test.ts`.

## Dogfood: agentgate on its own Dependabot PR

[piyush97/agentgate#8](https://github.com/piyush97/agentgate/pull/8) bumps the pinned agentgate SHA in `.github/workflows/agentgate.yml`. The gate blocked it in CI with `Protected path changed (modified): this file guards the gate, so a code owner must review it before merge.` A bot changed the workflow that runs the gate, so the block is intended. Merging it needs a human to apply `agentgate-approved`.
