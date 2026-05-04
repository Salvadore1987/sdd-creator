# ADR-003: Commander.js for the CLI surface

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** maintainers
- **Related:** ADR-001 (hexagonal), ADR-005 (provider abstraction)

## Context

`sdd` ships 11 top-level commands and several nested sub-command trees (`integrations <list|show|add|edit|remove|validate|spec|import>`, `add <topic|feature|adr|risk|integration>`, etc.) plus global options (`--verbose`, `--provider`, `--help`, `--version`). We need:

- Sub-commands.
- Per-command options + global options.
- `preAction` hooks (used to set `LOG_LEVEL=debug` and `SDD_CLAUDE_PROVIDER` from globals before any sub-command runs).
- Async actions (`parseAsync`).
- Auto-generated `--help`.

## Decision

Use **Commander.js** behind a thin wrapper in `src/commands/*.command.ts`. Each command exports a `build<Name>Command()` factory that returns a `Command` instance; `src/cli.ts` composes them via `program.addCommand(...)`. The root program is a factory (`buildProgram()`) so tests can construct it without side-effects.

The `preAction` hook is the single place where global option side-effects happen (env mutations). Action handlers throw classified errors instead of calling `process.exit` directly — `main()` catches them and routes through `handleCliError` (see ADR-004 for error model).

## Consequences

### Positive

- Sub-commands compose by name (no manual switch table).
- `--help` is generated automatically.
- `parseAsync` integrates with our async use-case services without adapters.
- Test surface is `buildProgram()` — verified end-to-end in `tests/integration/cli.program.test.ts`.

### Negative

- Commander mutates process global state via `preAction`. We accept this for `LOG_LEVEL` / `SDD_CLAUDE_PROVIDER`; everything else stays pure.
- Some option types still require a manual cast (`opts.format as ExportFormat`) because Commander's typings are loose.

## Alternatives considered

- **`yargs`.** Rejected: heavier API, slower to construct, less ergonomic for nested sub-command trees.
- **Hand-rolled parser.** Rejected: would re-implement help text, env-from-flag plumbing, validation, and exit-code mapping.
- **`oclif`.** Rejected: opinionated project structure that conflicts with our hexagonal layout.
