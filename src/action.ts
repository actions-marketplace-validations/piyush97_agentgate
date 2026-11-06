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

type EventsResult = { events: LabelEvent[] } | { error: string };

export function overrideBy(
  events: LabelEvent[],
  label: string,
  prAuthor: string,
  repoOwner?: string,
): { accepted: boolean; reason: string } {
  let latest: LabelEvent | undefined;
  for (const event of events) {
    if (!event || typeof event !== 'object') return { accepted: false, reason: 'the label event history is unreadable' };
    if (event.label?.name !== label) continue;
    if (event.event !== 'labeled' && event.event !== 'unlabeled') continue;
    latest = event;
  }

  if (latest === undefined) return { accepted: false, reason: 'the label was never applied to this PR' };
  if (latest.event === 'unlabeled') return { accepted: false, reason: 'the label was removed' };
  if (!latest.actor || typeof latest.actor.login !== 'string' || !latest.actor.login) {
    return { accepted: false, reason: 'the label event has no actor, so history is incomplete' };
  }
  if (latest.actor.type !== 'User') return { accepted: false, reason: `applied by a bot (@${latest.actor.login}); a human must approve` };
  const login = latest.actor.login;
  const isAuthor = login.toLowerCase() === prAuthor.toLowerCase();
  const isOwner = repoOwner !== undefined && login.toLowerCase() === repoOwner.toLowerCase();
  if (isAuthor && !isOwner) {
    return {
      accepted: false,
      reason: `applied by the PR author (@${login}); another maintainer or the repo owner must approve`,
    };
  }
  return { accepted: true, reason: isOwner ? `approval by repo owner @${login}` : `approval by @${login}` };
}

async function labelEvents(
  env: NodeJS.ProcessEnv,
  fetchFn: typeof fetch,
  prNumber: number,
): Promise<EventsResult> {
  const events: LabelEvent[] = [];
  let url: string | null =
    `${env['GITHUB_API_URL']}/repos/${env['GITHUB_REPOSITORY']}/issues/${prNumber}/events?per_page=100`;

  try {
    for (let page = 0; url !== null && page < 10; page++) {
      const res = await fetchFn(url, {
        headers: {
          Authorization: `Bearer ${env['INPUT_GITHUB-TOKEN']}`,
          Accept: 'application/vnd.github+json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return { error: 'invalid label event data' };
      events.push(...(data as LabelEvent[]));
      const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '');
      if (next && !next[1]!.startsWith(`${env['GITHUB_API_URL']}/`)) {
        return { error: 'unsafe pagination URL' };
      }
      url = next ? next[1]! : null;
    }
  } catch {
    return { error: 'could not read label events' };
  }

  return url === null ? { events } : { error: 'label-event pagination limit reached' };
}

export async function run(env: NodeJS.ProcessEnv, fetchFn: typeof fetch): Promise<number> {
  try {
    const eventPath = env['GITHUB_EVENT_PATH'];
    const event = eventPath ? (JSON.parse(readFileSync(eventPath, 'utf8')) as { action?: string; label?: { name: string }; pull_request?: PullRequestEvent; repository?: { owner?: { login?: string } } }) : {};
    const pr = event.pull_request;

    if (pr === undefined) {
      console.log('::error::agentgate runs on pull_request events');
      return 2;
    }

    const { files, ctx } = collect(env['GITHUB_WORKSPACE'] ?? process.cwd(), pr.base.sha, pr.head.sha, env['INPUT_CONFIG-PATH']);
    let findings: Finding[] = runGate(files, ctx);
    let note: string | undefined;

    const label = ctx.config.overrideLabel;
    const labelled = (pr.labels ?? []).some((l) => l.name === label);

    if (verdictOf(findings) === 'block' && labelled) {
      if (event.action === 'synchronize') {
        note = 'Override ignored: commits were pushed after approval. Remove and re-apply the label to approve these commits.';
      } else if (event.action !== 'labeled' || event.label?.name !== label) {
        note = 'Override ignored: the approval label was not applied in this run. Apply it to approve, or fix the findings.';
      } else {
        const result = await labelEvents(env, fetchFn, pr.number);
        if ('error' in result) {
          note = `Override ignored: could not read label events (${result.error}), so the label cannot be trusted.`;
        } else {
          const override = overrideBy(result.events, label, pr.user.login, event.repository?.owner?.login);
          if (override.accepted) {
            findings = downgrade(findings);
            note = `Override applied: ${override.reason}, so blocking findings are now warnings. Merge only after the review this records.`;
          } else {
            note = `Override ignored: ${override.reason}. Fix the findings, or ask a different reviewer to apply the label.`;
          }
        }
      }
    }

    const verdict = verdictOf(findings);
    const summaryPath = env['GITHUB_STEP_SUMMARY'];
    if (summaryPath) appendFileSync(summaryPath, `${toMarkdown(findings, verdict, note, label)}\n`);

    for (const annotation of toAnnotations(findings)) console.log(annotation);

    const outputPath = env['GITHUB_OUTPUT'];
    if (outputPath) appendFileSync(outputPath, `verdict=${verdict}\n`);

    return verdict === 'block' ? 1 : 0;
  } catch (e) {
    const message = e instanceof GateError ? e.message
      : e instanceof SyntaxError ? 'Cannot parse GitHub event JSON from GITHUB_EVENT_PATH.'
      : `agentgate failed: ${(e as Error).message}`;
    console.log(`::error::${message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
    return 2;
  }
}

if (import.meta.main) {
  run(process.env, fetch).then((code) => {
    process.exitCode = code;
  });
}
