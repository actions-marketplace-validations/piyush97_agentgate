import { appendFileSync, readFileSync } from 'node:fs';
import { collect } from './collect.ts';
import { downgrade, runGate, verdictOf } from './engine.ts';
import { toAnnotations, toMarkdown } from './report.ts';
import { GateError } from './types.ts';
import type { Finding } from './types.ts';

export interface LabelEvent {
  event: string;
  label?: { name: string };
  actor: { login: string; type: string };
}

interface PullRequestEvent {
  number: number;
  base: { sha: string };
  head: { sha: string };
  user: { login: string };
  labels?: Array<{ name: string }>;
}

type EventsResult = { events: LabelEvent[] } | { status: number };

export function overrideBy(events: LabelEvent[], label: string, prAuthor: string): { accepted: boolean; reason: string } {
  let latest: LabelEvent | undefined;
  for (const event of events) {
    if (event.label?.name !== label) continue;
    if (event.event !== 'labeled' && event.event !== 'unlabeled') continue;
    latest = event;
  }

  if (latest === undefined) return { accepted: false, reason: 'label not found in events' };
  if (latest.event === 'unlabeled') return { accepted: false, reason: 'label was removed' };
  if (latest.actor.type !== 'User') return { accepted: false, reason: `applied by a bot (${latest.actor.login})` };
  if (latest.actor.login === prAuthor) return { accepted: false, reason: `applied by the PR author (${latest.actor.login})` };
  return { accepted: true, reason: `applied by @${latest.actor.login}` };
}

async function labelEvents(
  env: NodeJS.ProcessEnv,
  fetchFn: typeof fetch,
  prNumber: number,
): Promise<EventsResult> {
  const events: LabelEvent[] = [];
  let url: string | null =
    `${env['GITHUB_API_URL']}/repos/${env['GITHUB_REPOSITORY']}/issues/${prNumber}/events?per_page=100`;

  for (let page = 0; url !== null && page < 10; page++) {
    const res = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${env['INPUT_GITHUB-TOKEN']}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return { status: res.status };
    events.push(...((await res.json()) as LabelEvent[]));
    const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '');
    // Never follow a next page off the API host: it carries the token.
    url = next && next[1]!.startsWith(`${env['GITHUB_API_URL']}/`) ? next[1]! : null;
  }

  return { events };
}

export async function run(env: NodeJS.ProcessEnv, fetchFn: typeof fetch): Promise<number> {
  const eventPath = env['GITHUB_EVENT_PATH'];
  const event = eventPath ? (JSON.parse(readFileSync(eventPath, 'utf8')) as { pull_request?: PullRequestEvent }) : {};
  const pr = event.pull_request;

  if (pr === undefined) {
    console.log('::error::agentgate runs on pull_request events');
    return 2;
  }

  try {
    const { files, ctx } = collect(env['GITHUB_WORKSPACE'] ?? process.cwd(), pr.base.sha, pr.head.sha, env['INPUT_CONFIG-PATH']);
    let findings: Finding[] = runGate(files, ctx);
    let note: string | undefined;

    const label = ctx.config.overrideLabel;
    const labelled = (pr.labels ?? []).some((l) => l.name === label);

    if (verdictOf(findings) === 'block' && labelled) {
      const result = await labelEvents(env, fetchFn, pr.number);
      if ('status' in result) {
        note = `Override check failed: HTTP ${result.status}`;
      } else {
        const override = overrideBy(result.events, label, pr.user.login);
        if (override.accepted) {
          findings = downgrade(findings);
          note = `Override by ${override.reason.replace(/^applied by /, '')} via label ${label}`;
        } else {
          note = `Override label ignored: ${override.reason}`;
        }
      }
    }

    const verdict = verdictOf(findings);
    const summaryPath = env['GITHUB_STEP_SUMMARY'];
    if (summaryPath) appendFileSync(summaryPath, `${toMarkdown(findings, verdict, note)}\n`);

    for (const annotation of toAnnotations(findings)) console.log(annotation);

    const outputPath = env['GITHUB_OUTPUT'];
    if (outputPath) appendFileSync(outputPath, `verdict=${verdict}\n`);

    return verdict === 'block' ? 1 : 0;
  } catch (e) {
    if (e instanceof GateError) {
      console.log(`::error::${e.message}`);
      return 2;
    }
    throw e;
  }
}

if (import.meta.main) {
  run(process.env, fetch).then((code) => {
    process.exitCode = code;
  });
}
