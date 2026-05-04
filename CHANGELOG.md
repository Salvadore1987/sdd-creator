# Changelog

All notable changes to **sdd-generator** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial pre-release packaging — `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`, `repository` / `homepage` / `bugs` URLs in `package.json`.
- `npm publish --dry-run` workflow documented in `CONTRIBUTING.md` (release flow).
- ADRs `docs/adr/ADR-001` … `ADR-005` covering hexagonal architecture, Handlebars, Commander, Zod, and the dual-provider abstraction; `docs/adr/README.md` index.
- `sdd integrations spec --format html|pdf|confluence` (with `--export-path`) — closes the only outstanding Phase 5.7 deferral.
- `tests/integration/InitMatrix.test.ts` — exhaustive 5×5 stack × architecture init matrix (25 cases).
- `tests/integration/LoanServiceLintSmoke.test.ts` — DoD lint check: 0 errors on the bundled `loan-service` fixture.
- `tests/integration/Arc42Coverage.test.ts` — DoD arc42 check: rendered SDD contains all 12 anchor sections.
- `tests/integration/IntegrationsSpecFormat.test.ts` — covers the new `integrations spec --format` wiring.

## [0.1.0] — 2026-05-04

First public preview. The CLI is feature-complete through Phase 7; the only thing left for v1.0.0 is the actual `npm publish` of this artefact and its npm-side smoke testing.

### Added

#### Phase 1 — Project setup

- TypeScript strict (target ES2022, `moduleResolution: node16`), Jest (unit / integration / e2e projects), ESLint + Prettier.
- npm scripts: `dev`, `build`, `start`, `test`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `test:watch`, `lint`, `lint:fix`, `format`, `type-check`, `prepublishOnly`.
- `bin: { sdd, sdd-generator } → dist/cli.js` with `#!/usr/bin/env node` shebang.

#### Phase 2 — Domain & adapters (foundation)

- Domain models: `ProjectConfig`, `Requirement`, `AcceptanceCriterion`, `NFR`, `ADR`, `Risk`, `Stakeholder`, `GlossaryTerm`, `Integration`, plus `Stack` / `Architecture` / `IntegrationCategory` enums.
- Stable IDs (`FR-NNN`, `NFR-NNN`, `ADR-NNN`, `RISK-NNN`, `SH-NNN`, `INT-NNN`, `AC-FR-NNN-N`); UUIDv7 for technical IDs.
- Ports: `IFileRepository`, `IClaudeProvider`, `ILogger`, `ITemplateEngine`, `IIntegrationImporter`, `IClaudeCliProbe`, `IRequirementImporter`, `ISpecExporter`.
- Adapters: `FileRepository` (`fs/promises`), `ClaudeApiAdapter` (`@anthropic-ai/sdk` + retry), `ClaudeCliAdapter` (`execFile claude -p`), `ClaudeProviderFactory` (precedence flag > env > config > default), `CachingClaudeProvider` (decorator with on-disk cache), `HandlebarsTemplateEngine` (custom helpers `eq`/`ne`/`join`/`formatDate`/`lower`/`upper`/`markdownTable`/`mermaidEscape`), `WinstonLogger` (JSON + redaction), importer stubs.
- Domain services: `ConfigManager`, `RequirementValidator`, `IntegrationCatalog`, `PromptBuilder`, `StatusTracker`, `CompletenessLinter`.

#### Phase 3 — `init`

- `sdd init` interactive flow: provider → language → stack → architecture → technologies → metadata.
- `--non-interactive --config <file>`, `--force`, `--merge` idempotency modes.
- Probe Claude CLI installation/authentication (continues with a clear hint if missing).

#### Phase 4 — `brainstorm` (10 stages)

- `sdd brainstorm <topic>` for `stakeholders`, `context`, `constraints`, `glossary`, `features`, `domain`, `quality`, `dependencies`, `anti`, `compliance`.
- Per-topic Zod schema, per-stack prompt overrides, automatic stale propagation to dependent sections, `--skip` flag.

#### Phase 4.5 — `integrations` (separate lifecycle)

- `sdd integrations <list|show|add|edit|remove|validate|spec|import>`.
- 13 categories with prompts + per-category `extra` schemas: `bpms`, `message-broker`, `database`, `cache`, `search`, `identity`, `storage`, `observability`, `payment`, `notification`, `external-api`, `legacy`, `custom`.
- Importers: `OpenApiImporter`, `AsyncApiImporter`, `BpmnImporter` (regex-based, no extra deps).
- Renders `docs/INTEGRATIONS.md`.

#### Phase 5 — `spec`

- `sdd spec` renders 14 arc42 / IEEE 29148 sections to `docs/SDD.md`: Executive Summary, Stakeholders, Product Requirements, Quality Attributes, Glossary, System Architecture (C4 L1/L2/L3), Detailed Design (incl. ER + BPMN sub-section), Testing Strategy, Deployment & Operations, Implementation Plan, ADR Log, Risks Register, Compliance, Traceability Matrix.
- `MermaidDiagramBuilder` auto-generates C4 context, domain class diagrams, ER diagrams from aggregates, broker topology, BPMN flow from bpms integrations; Claude only invoked for narrative + diagrams that need free-form generation.
- `MermaidValidator` (header whitelist + balanced brackets) + re-prompt loop on invalid Mermaid; sanitize-pass marks remaining bad blocks with `<!-- TODO: human review -->`.
- `--placeholders` renders skipped sections as actionable hints.
- Custom output path via `--output`.
- Golden snapshot tests for `loan-service`, `simple-cli-tool`, `event-platform`.

#### Phase 5.5 — Status / Add / Edit / Remove

- `sdd status` — table + `--json` mode showing completed / skipped / stale per topic with `nextCommand` suggestions.
- `sdd add | edit | remove <topic>` — re-run brainstorm or mark skipped.
- `sdd add feature | adr | risk` — granular insertion via JSON `--input`, auto-assigns FR-NNN / ADR-NNN / RISK-NNN.
- `sdd add integration` aliases to `integrations add`.

#### Phase 5.6 — `lint`

- `sdd lint` checks: `fr-without-ac`, `nfr-without-target`, `unresolved-reference`, `mermaid-invalid`, `glossary-unused`, `section-skipped`, `integration-missing-secrets-ref`, arc42 coverage.
- `--strict` promotes skipped sections + arc42 gaps to errors.
- `--warnings-as-errors` collapses exit 2 → 1 for CI gating.
- `--spec <file>` overrides default SDD path.
- Exit codes 0 / 1 (errors) / 2 (warnings).

#### Phase 5.7 — Update / Export / Import / Migrate

- `sdd spec --update` — diff mode via `.sdd/spec-cache.json`; per-section input hashing reuses cached markdown when inputs unchanged.
- `sdd spec --format html|pdf|confluence` — Pandoc-backed HTML / PDF (graceful `PandocNotInstalledError` on ENOENT); Confluence stub.
- `sdd import --from md|jira|linear` — `MarkdownRequirementImporter` (`## FR-NNN ... ### Acceptance` parser), `JiraJsonImporter`, `LinearJsonImporter` (priority mapping).
- `sdd migrate [--dry-run]` — `Migrator` registry of migration steps; safely refuses documents newer than the CLI.
- `sdd init --industry fintech|healthcare|e-commerce` — pre-fills `compliance.items` (PCI-DSS / HIPAA / GDPR-CCPA presets).

#### Phase 6 — Testing & Quality

- E2E `tests/e2e/full-workflow.test.ts` — `init → integrations add → brainstorm features → spec → lint` end-to-end with mocked Claude provider.
- Contract tests for ports — `IFileRepository` (FS + in-memory), `IClaudeProvider` (cli + api kinds), `ITemplateEngine`, `ILogger` (Winston + capturing).
- Lifted coverage gates: domain ≥ 90%, adapters ≥ 75%, application ≥ 85%, utils ≥ 95%.
- 45 test suites / 222 tests / 3 golden snapshots.

#### Phase 7 — CLI Integration

- `src/cli.ts` — `buildProgram()` factory + async `main(argv)`; `if (require.main === module)` shim.
- Global options: `--verbose` (sets `LOG_LEVEL=debug`), `--provider <cli|api>` (sets `SDD_CLAUDE_PROVIDER`), `--help`, `--version`.
- Error hierarchy `src/cli/errors.ts`: `SddCliError` (base) → `ValidationError` (2) / `LintFailedError` (2) / `ProviderInvocationError` (3) / `FileSystemError` (4); `EXIT_CODES = {success:0, generic:1, validation:2, provider:3, filesystem:4}`.
- `classifyError()` maps port errors (Claude*, FileNotFound, Permission, JsonParse, ZodError) to CLI errors with actionable hints.
- `handleCliError()` prints `✖ <message>` + `→ <hint>`; verbose mode dumps stack trace.
- `lint.command` throws `LintFailedError` instead of `process.exit`, routing through the unified handler.
- `src/index.ts` exports a public library API: domain models, services, adapters, ports, errors, `buildProgram` / `main`.

[Unreleased]: https://github.com/Salvadore1987/sdd-creator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Salvadore1987/sdd-creator/releases/tag/v0.1.0
