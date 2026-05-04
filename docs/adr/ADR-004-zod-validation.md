# ADR-004: Zod for runtime schema validation

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** maintainers
- **Related:** ADR-005 (provider abstraction), ADR-001 (hexagonal)

## Context

The CLI reads three categories of untrusted JSON at runtime:

1. **On-disk documents:** `.sdd/config.json`, `.sdd/requirements.json`, `.sdd/integrations.json` — humans hand-edit these.
2. **Claude responses:** brainstorm replies must conform to per-topic schemas (`stakeholders` → `{items: Stakeholder[]}`, `features` → `{items: Requirement[]}`, etc.).
3. **External imports:** OpenAPI / AsyncAPI / BPMN / Markdown / Jira / Linear payloads.

We need:

- Strong runtime validation (TypeScript types alone are not enough — they erase at runtime).
- Per-topic / per-category schemas as first-class values that can be passed to `IClaudeProvider.completeJson<T>(prompt, schema)`.
- Compositional schemas (an `Integration` reuses `Endpoint`, `Auth`, `IntegrationCategory`).
- TypeScript type inference (`z.infer<typeof requirementsDocumentSchema>`).
- Clear error paths — Zod errors have structured `issues`, which `classifyError` routes to `ValidationError` with exit code 2.

## Decision

Use **Zod** for all runtime validation. Schemas live in `src/utils/validators.ts` (root document schemas) and `src/domain/BrainstormSchemas.ts` (per-topic response shapes). `IClaudeProvider.completeJson<T>(prompt, schema, opts)` is the single entry point for schema-validated LLM calls.

Stable IDs (`FR-NNN`, `NFR-NNN`, `ADR-NNN`, `RISK-NNN`, `SH-NNN`, `INT-NNN`, `AC-FR-NNN-N`) are validated by Zod regex, not hand-written code.

## Consequences

### Positive

- Single source of truth: the schema *is* the type (no drift between `interface Foo {}` and a parser).
- Per-topic Zod schemas are passed directly to `IClaudeProvider.completeJson<T>(prompt, schema)` — no second parsing pass.
- Errors flow through `classifyError` → `ValidationError` (exit 2) with a clear hint.
- Snapshots in `tests/integration/SpecService.golden.test.ts` exercise the validators end-to-end on three demo projects.

### Negative

- Bundle size: ~50 kB (acceptable for a CLI).
- Zod 3.x parses with throwing semantics by default; we rely on `safeParse` only inside the linter where partial invalidation should not abort.

## Alternatives considered

- **`io-ts`.** Rejected: less ergonomic without `fp-ts`, type errors are noisier.
- **`ajv` + JSON Schema.** Rejected: hand-written JSON schema duplicates the TypeScript types, no inference.
- **`yup`.** Rejected: weaker TypeScript ergonomics for the discriminated unions we use (priority, severity, integration category).
- **Hand-rolled validators.** Rejected: would not compose, would not give us inference, would not give us per-call schemas for the LLM bridge.
