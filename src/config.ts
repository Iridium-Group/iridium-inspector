import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  applyEnvOverrides,
  applyDefaults,
  CONFIG_PATH_ENV,
  DEFAULT_CONFIG_FILE,
  parseJsonc,
  validateConfig,
  type ConfigIssue,
  type EnvSource,
  type IridiumConfig,
  type IridiumConfigInput,
} from '@iridium-group/config';

export interface ConfigReport {
  /** The file read, or undefined when only defaults and environment were used. */
  file?: string;
  /** Settings taken from environment variables, as variable name to path. */
  overrides: { name: string; path: string }[];
  issues: ConfigIssue[];
  /** The resolved configuration, present only when there are no issues. */
  config?: IridiumConfig;
}

export interface InspectConfigOptions {
  env?: EnvSource;
  cwd?: string;
}

/**
 * Load a config the way the proxy would, but collect every problem instead of throwing, and
 * report which settings came from the environment.
 */
export async function inspectConfig(
  path: string | undefined,
  options: InspectConfigOptions = {},
): Promise<ConfigReport> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const explicit = path ?? env[CONFIG_PATH_ENV];
  const file = resolve(cwd, explicit ?? DEFAULT_CONFIG_FILE);
  const report: ConfigReport = { overrides: [], issues: [] };

  let input: unknown = {};
  try {
    const text = await readFile(file, 'utf8');
    report.file = file;
    try {
      input = parseJsonc(text, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.issues.push({ path: '', message });
      return report;
    }
  } catch (cause) {
    const missing = (cause as NodeJS.ErrnoException).code === 'ENOENT';
    if (explicit || !missing) {
      report.issues.push({ path: '', message: `cannot read ${file}: ${(cause as Error).message}` });
      return report;
    }
  }

  const overridden = applyEnvOverrides(input, env);
  for (const [overridePath, name] of overridden.applied) {
    report.overrides.push({ name, path: overridePath });
  }
  report.issues.push(...overridden.issues, ...validateConfig(overridden.input));
  if (report.issues.length === 0) {
    report.config = applyDefaults(overridden.input as IridiumConfigInput);
  }
  return report;
}
