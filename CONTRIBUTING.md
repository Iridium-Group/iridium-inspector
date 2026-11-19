# Contributing

Run `npm ci`, then `npm run format:check`, `npm run typecheck`, `npm test` and `npm run build`
before opening a pull request. CLI tests call `run()` in-process with injected IO; keep them free
of stdin, network and child processes, except the single bin smoke test, which has a timeout.
