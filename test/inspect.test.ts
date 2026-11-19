import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { applyDefaults } from '@iridium-group/config';
import { run } from '../src/cli.ts';
import { inspectConfig } from '../src/config.ts';
import { checkUrl } from '../src/url.ts';

const defaults = applyDefaults({});

async function tmp(name: string, text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-'));
  await writeFile(join(dir, name), text);
  return dir;
}

function capture(env: Record<string, string> = {}, cwd = process.cwd()) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t), env, cwd },
  };
}

describe('checkUrl', () => {
  it('allows an ordinary public URL', () => {
    const c = checkUrl('https://example.com/a', defaults);
    assert.equal(c.allowed, true);
    assert.equal(c.port, 443);
  });
  it('blocks private and loopback addresses by default', () => {
    for (const u of [
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://[::1]/',
      'http://localhost/',
    ]) {
      assert.equal(checkUrl(u, defaults).allowed, false, u);
    }
  });
  it('allows them when blockPrivateAddresses is off', () => {
    const config = applyDefaults({ security: { blockPrivateAddresses: false } });
    assert.equal(checkUrl('http://127.0.0.1/', config).allowed, true);
  });
  it('blocks blocked ports and ports outside allowedPorts', () => {
    assert.equal(checkUrl('http://example.com:25/', defaults).allowed, false);
    const config = applyDefaults({ security: { allowedPorts: [443] } });
    assert.equal(checkUrl('http://example.com/', config).allowed, false);
    assert.equal(checkUrl('https://example.com/', config).allowed, true);
  });
  it('rejects bad input and other schemes', () => {
    assert.equal(checkUrl('not a url', defaults).allowed, false);
    assert.equal(checkUrl('ftp://example.com/', defaults).allowed, false);
  });
  it('never echoes credentials', () => {
    const c = checkUrl('https://user:secret@example.com/', defaults);
    assert.ok(!c.input.includes('secret'));
  });
});

describe('inspectConfig', () => {
  it('reports defaults when no file exists', async () => {
    const dir = await tmp('other.txt', '');
    const r = await inspectConfig(undefined, { cwd: dir, env: {} });
    assert.equal(r.file, undefined);
    assert.equal(r.issues.length, 0);
    assert.ok(r.config);
  });
  it('fails when an explicit file is missing', async () => {
    const dir = await tmp('other.txt', '');
    const r = await inspectConfig('nope.json', { cwd: dir, env: {} });
    assert.equal(r.issues.length, 1);
  });
  it('reads JSONC and collects every issue', async () => {
    const dir = await tmp(
      'iridium.config.json',
      '{ // c\n "server": {"port": 99999}, "logging": {"level": "loud"} }',
    );
    const r = await inspectConfig(undefined, { cwd: dir, env: {} });
    assert.equal(r.issues.length, 2);
    assert.equal(r.config, undefined);
  });
  it('lists environment overrides', async () => {
    const dir = await tmp('other.txt', '');
    const r = await inspectConfig(undefined, { cwd: dir, env: { IRIDIUM_SERVER__PORT: '9000' } });
    assert.deepEqual(r.overrides, [{ name: 'IRIDIUM_SERVER__PORT', path: 'server.port' }]);
    assert.equal(r.config?.server.port, 9000);
  });
});

describe('run', () => {
  it('prints help and exits 0', async () => {
    const c = capture();
    assert.equal(await run(['--help'], c.io), 0);
    assert.match(c.out.join(''), /Usage/);
  });
  it('exits 2 on usage errors', async () => {
    for (const args of [[], ['bogus'], ['url'], ['--nope']]) {
      const c = capture();
      assert.equal(await run(args, c.io), 2, args.join(' '));
    }
  });
  it('config exits 1 for an invalid file and 0 for a valid one', async () => {
    const bad = await tmp('iridium.config.json', '{"server":{"port":70000}}');
    assert.equal(await run(['config'], capture({}, bad).io), 1);
    const good = await tmp('iridium.config.json', '{"server":{"port":8080}}');
    const c = capture({}, good);
    assert.equal(await run(['config', '--json'], c.io), 0);
    assert.equal(JSON.parse(c.out.join('')).config.server.port, 8080);
  });
  it('url exits 1 for a blocked URL', async () => {
    const dir = await tmp('other.txt', '');
    const c = capture({}, dir);
    assert.equal(await run(['url', 'http://127.0.0.1/'], c.io), 1);
    assert.match(c.out.join(''), /BLOCKED/);
    assert.equal(await run(['url', 'https://example.com/'], capture({}, dir).io), 0);
  });
});

describe('bin', () => {
  it('runs the built binary and exits', { skip: !process.env.INSPECTOR_BUILT }, () => {
    const r = spawnSync(process.execPath, ['bin/iridium-inspect.js', '--help'], {
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage/);
  });
});
