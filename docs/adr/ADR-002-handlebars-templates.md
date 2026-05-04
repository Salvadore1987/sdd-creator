# ADR-002: Handlebars for template rendering

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** maintainers
- **Related:** ADR-001 (hexagonal)

## Context

The generator renders three classes of artefacts:

1. Per-stack / per-architecture init templates (`src/templates/{stacks,architectures}/<kind>/init-template.md`).
2. Per-integration-category sections in `INTEGRATIONS.md` (overview / cross-cutting / per-entry / traceability).
3. The 14-section SDD document (`src/templates/spec/_base/*.hbs`).

Template requirements:

- **Logic-light expressions** (`{{x}}`, `{{#if}}`, `{{#each}}`) — anything heavier belongs in `PromptBuilder` / domain code.
- **Custom helpers**: `eq`, `ne`, `join`, `formatDate`, `lower`, `upper`, `markdownTable`, `mermaidEscape`.
- **Partials** for shared sections.
- **Compile cache** so re-rendering 14 sections per run is cheap.
- Pure rendering — no async, no I/O leaking into templates.
- Mature, widely-known syntax so contributors can edit templates without re-learning a DSL.

## Decision

Use **Handlebars** behind an `ITemplateEngine` port (`HandlebarsTemplateEngine` adapter). Compiled templates are cached in-process by source string.

## Consequences

### Positive

- Mature, well-documented, widely-known syntax.
- Trivial to add helpers and partials at runtime through the port API.
- Compile cache makes per-section rendering essentially free after the first call.
- Switching engines later (Eta, Nunjucks, EJS) is a single-adapter change.

### Negative

- No type-checked template expressions. We mitigate with snapshot tests (`tests/integration/SpecService.golden.test.ts`).
- Handlebars `noEscape: true` means template authors must escape user input themselves where it matters (currently only `mermaidEscape` does this).

## Alternatives considered

- **EJS / Mustache** — comparable feature set, smaller community for helpers and partials.
- **Tagged template literals.** Rejected: encodes data into the template language and bypasses the port abstraction.
- **Pure string concatenation in services.** Rejected: bloats services with rendering details and breaks the "no rendering in services" rule.
