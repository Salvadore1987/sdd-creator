# ADR-005: Two Claude provider backends behind a single port

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** maintainers
- **Related:** ADR-001 (hexagonal), ADR-004 (Zod)

## Context

Users pay for Claude in two distinct ways:

- **Subscription** (Pro / Max / Team) — already includes API quota, but only via the local Claude Code CLI binary (`claude -p ... --output-format json`) over an OAuth session.
- **API key** — direct billing per-token via `ANTHROPIC_API_KEY`.

A CLI that hard-codes `@anthropic-ai/sdk` excludes the first cohort; a CLI that hard-codes `child_process.execFile('claude', ...)` excludes the second. Both modes have different rate-limit semantics, different auth failure modes, and different installation prerequisites.

## Decision

Define **a single port** `IClaudeProvider` with `complete(prompt, opts)` and `completeJson<T>(prompt, schema, opts)`. Implement **two adapters**:

- `ClaudeApiAdapter` — `@anthropic-ai/sdk`, exponential retry on 429 (honouring `Retry-After`), bounded retries on 5xx, `ClaudeApiAuthError` on missing/invalid key.
- `ClaudeCliAdapter` — `child_process.execFile('claude', ['-p', prompt, '--output-format', 'json'])` with a timeout (`SDD_CLAUDE_CLI_TIMEOUT_MS`, default 120s); `ClaudeCliNotInstalledError` on ENOENT and `ClaudeCliAuthError` when the CLI demands `claude login`.

Selection happens in `ClaudeProviderFactory.resolveKind({flag, env, configValue})` with the precedence:

1. `--provider <cli|api>` flag (CLI argument).
2. `SDD_CLAUDE_PROVIDER` env var.
3. `claude.provider` in `.sdd/config.json` (set by `sdd init`).
4. Default: `cli`.

A `CachingClaudeProvider` decorator wraps either adapter, keying on `hash(model + prompt + opts)` and persisting to `.sdd/cache/`. This means re-running `sdd spec --update` with unchanged inputs neither burns API tokens nor consumes CLI subscription quota.

## Consequences

### Positive

- One CLI binary serves both subscription and API users.
- Adding a future provider (Bedrock, Vertex AI) is a single new adapter implementation.
- All calling code (`BrainstormService`, `SpecService`, etc.) depends only on `IClaudeProvider` — they cannot accidentally couple to a transport detail.
- Retry / cache / auth concerns are isolated to adapter layer, simplifying domain code.

### Negative

- Two transports to keep in sync as Anthropic evolves the API and the Code CLI.
- Rate-limit semantics differ — API gives `429 Retry-After`, CLI gives subscription-level errors. Each adapter handles its own translation.
- The CLI adapter requires the `claude` binary in `PATH` (or `SDD_CLAUDE_CLI_BIN`); we surface this as an actionable `ClaudeCliNotInstalledError` with install instructions.

## Alternatives considered

- **API only.** Rejected: cuts off the large subscription user base.
- **CLI only.** Rejected: poor fit for CI/CD where there is no OAuth login session.
- **Custom HTTP client without `@anthropic-ai/sdk`.** Rejected: would re-implement retry, streaming, model versioning.
