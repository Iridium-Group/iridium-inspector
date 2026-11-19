# @iridium-group/inspector

Command-line tool that checks an Iridium configuration file and shows how a configuration treats
a given URL. It uses [`@iridium-group/config`](https://github.com/Iridium-Group/iridium-config)
to load and validate, and [`@iridium-group/utils`](https://github.com/Iridium-Group/iridium-utils)
for URL and address handling. It never touches the network.

## Install

```sh
npm install --save-dev github:Iridium-Group/iridium-inspector
npx iridium-inspect --help
```

Requires Node 22.18 or later.

## Commands

### `iridium-inspect config [file]`

Loads `file` (default: `$IRIDIUM_CONFIG`, then `iridium.config.json` if present), applies
`IRIDIUM_*` environment overrides, and prints every problem found or the resolved settings.
Exits 1 if the config is invalid.

### `iridium-inspect url <url> [file]`

Loads the config the same way and reports whether the security settings let the proxy fetch
`<url>`, with the reason for each rule that applied. Exits 1 if the URL is blocked.

Add `--json` to either command for machine-readable output. Credentials in URLs are never printed.

## Limits

`url` examines the URL text only. A hostname that resolves to a private address is not caught,
because the check does not do DNS lookups; the proxy checks again after resolution.

## Library

```ts
import { inspectConfig, checkUrl } from '@iridium-group/inspector';

const report = await inspectConfig('iridium.config.json');
if (report.config) console.log(checkUrl('http://127.0.0.1/', report.config).allowed); // false
```

## Development

```sh
npm ci
npm run typecheck && npm test && npm run build
```

## License

MIT
