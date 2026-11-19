#!/usr/bin/env node
import { run } from '../dist/cli.js';

const code = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  env: process.env,
  cwd: process.cwd(),
});
process.exitCode = code;
