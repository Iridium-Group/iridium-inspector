import { parseArgs } from 'node:util';
import { inspectConfig } from './config.ts';
import { renderConfig, renderUrl } from './render.ts';
import { checkUrl } from './url.ts';
import type { EnvSource } from '@iridium-group/config';

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: EnvSource;
  cwd: string;
}

export const USAGE = `Usage: iridium-inspect <command> [options]

Commands:
  config [file]        Validate a config file and show the resolved settings
  url <url> [file]     Show whether the config allows the proxy to fetch a URL

Options:
  --json               Print machine-readable JSON
  -h, --help           Show this help

Exit codes: 0 ok, 1 invalid config or blocked URL, 2 usage error.`;

/**
 * Run the CLI and return its exit code. Never reads stdin and never touches the network, so it
 * always finishes once the config file has been read.
 */
export async function run(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
    });
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}\n`);
    return 2;
  }
  const { json, help } = parsed.values;
  const [command, ...rest] = parsed.positionals;
  if (help || !command) {
    (help ? io.stdout : io.stderr)(`${USAGE}\n`);
    return help ? 0 : 2;
  }
  const options = { env: io.env, cwd: io.cwd };

  if (command === 'config') {
    if (rest.length > 1) return usageError(io, 'config takes at most one file');
    const report = await inspectConfig(rest[0], options);
    io.stdout(`${json ? JSON.stringify(report, null, 2) : renderConfig(report)}\n`);
    return report.issues.length === 0 ? 0 : 1;
  }

  if (command === 'url') {
    const [target, file] = rest;
    if (!target || rest.length > 2) return usageError(io, 'url takes a URL and an optional file');
    const report = await inspectConfig(file, options);
    if (!report.config) {
      io.stderr(`${renderConfig(report)}\n`);
      return 1;
    }
    const check = checkUrl(target, report.config);
    io.stdout(`${json ? JSON.stringify(check, null, 2) : renderUrl(check)}\n`);
    return check.allowed ? 0 : 1;
  }

  return usageError(io, `unknown command "${command}"`);
}

function usageError(io: CliIo, message: string): number {
  io.stderr(`${message}\n\n${USAGE}\n`);
  return 2;
}
