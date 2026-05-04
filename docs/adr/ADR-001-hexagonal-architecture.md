# ADR-001: Hexagonal architecture (ports and adapters)

- **Status:** Accepted
- **Date:** 2026-05-04
- **Deciders:** maintainers
- **Related:** ADR-002 (Handlebars), ADR-005 (provider abstraction)

## Context

The CLI talks to several external concerns: filesystem, Anthropic API, Claude Code CLI binary, terminal output, template rendering, BPMN/OpenAPI/AsyncAPI parsers, Pandoc. Each concern is testable in isolation but mixing them produces brittle code: tests need real `fs` for everything, retry/auth logic seeps into use-case code, and swapping `cli` for `api` provider becomes invasive.

## Decision

Adopt a **hexagonal / ports-and-adapters** layout with strict inward dependencies:

- `src/ports/` — *interfaces only* (`IFileRepository`, `IClaudeProvider`, `ILogger`, `ITemplateEngine`, `IIntegrationImporter`, `IClaudeCliProbe`, `IRequirementImporter`, `ISpecExporter`).
- `src/adapters/` — concrete impls (`fs/promises`, `@anthropic-ai/sdk`, `child_process`, `winston`, Handlebars, Pandoc, importers/exporters).
- `src/domain/` — pure logic: validators, ID generation, status tracking, linter rules, mermaid utilities. **No I/O.**
- `src/application/` — use-case services (`InitService`, `BrainstormService`, `IntegrationsService`, `SpecService`, `LintService`, `StatusService`, `RequirementsItemService`). They accept ports via constructor and orchestrate domain + ports. **No direct adapter imports.**
- `src/commands/` — Commander wrappers; thin DI layer that wires application services.

## Consequences

### Positive

- Tests mock at the port boundary: `IClaudeProvider` is always stubbed in `*.test.ts`; `IFileRepository` is real (tmpdir) in integration tests, in-memory in contract tests.
- Swapping the Claude transport (`cli` ↔ `api`) is a one-line change in `ClaudeProviderFactory`.
- Future Confluence/Notion/Jira exporters bolt on as new `ISpecExporter` implementations.
- The dependency graph is acyclic and the layers can be type-checked independently.

### Negative

- Slightly more files than a single-package CLI. We accept this in exchange for testability.
- Constructor injection tax: every service has a `deps` and `options` object.

## Alternatives considered

- **Layered architecture (presentation → service → repository).** Rejected because it makes the Claude provider a leaky abstraction (HTTP retry logic ends up in services).
- **Single flat `src/` directory.** Rejected because tests would need to spin up a real Anthropic client.
