#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { collect } from './collect.js';
import { runGate, verdictOf } from './engine.js';
import { toJson, toMarkdown } from './report.js';
import { GateError } from './types.js';
const USAGE = 'Usage: agentgate check --base <ref> [--head <ref>] [--config <path>] [--format md|json]';
export function main(argv, io) {
    let values;
    let positionals;
    try {
        const parsed = parseArgs({
            args: argv,
            strict: true,
            allowPositionals: true,
            options: {
                base: { type: 'string' },
                head: { type: 'string' },
                config: { type: 'string' },
                format: { type: 'string' },
                help: { type: 'boolean', short: 'h' },
            },
        });
        values = parsed.values;
        positionals = parsed.positionals;
    }
    catch (e) {
        io.err(e.message);
        io.err(USAGE);
        return 2;
    }
    if (values.help) {
        io.out(USAGE);
        return 0;
    }
    if (positionals.length !== 1 || positionals[0] !== 'check') {
        io.err('agentgate: expected the "check" command');
        io.err(USAGE);
        return 2;
    }
    if (!values.base) {
        io.err('agentgate check requires --base <ref>');
        return 2;
    }
    const format = values.format ?? 'md';
    if (format !== 'md' && format !== 'json') {
        io.err(`agentgate: unknown --format "${format}", expected md or json`);
        return 2;
    }
    try {
        const { files, ctx } = collect(io.cwd, values.base, values.head ?? 'HEAD', values.config);
        const findings = runGate(files, ctx);
        const verdict = verdictOf(findings);
        io.out(format === 'json' ? toJson(findings, verdict) : toMarkdown(findings, verdict));
        return verdict === 'block' ? 1 : 0;
    }
    catch (e) {
        if (e instanceof GateError) {
            io.err(e.message);
            return 2;
        }
        throw e;
    }
}
if (import.meta.main) {
    process.exitCode = main(process.argv.slice(2), { cwd: process.cwd(), out: console.log, err: console.error });
}
