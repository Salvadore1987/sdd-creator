# Contributing to sdd-generator

Thanks for your interest in contributing! This project is in active development — bug reports, feature ideas, and PRs are all welcome.

## Quick start

```bash
git clone https://github.com/Salvadore1987/sdd-creator.git
cd sdd-creator
npm install
npm test
```

The CLI runs locally via `npm run dev -- <command>` (uses `ts-node`), or build first with `npm run build` and use `node dist/cli.js`.

## Project layout

Hexagonal / ports-and-adapters. Dependencies point inward.

- `src/ports/` — interface definitions only (`IFileRepository`, `IClaudeProvider`, `ILogger`, `ITemplateEngine`, …).
- `src/adapters/` — concrete implementations (`fs/promises`, `@anthropic-ai/sdk`, `winston`, Handlebars, importers, exporters).
- `src/domain/` — pure logic: validators, ID generation, status tracking, linter rules, mermaid utilities.
- `src/application/` — use-case services: `InitService`, `BrainstormService`, `IntegrationsService`, `SpecService`, `LintService`, `StatusService`, `RequirementsItemService`.
- `src/commands/` — Commander.js wrappers; thin DI layer that wires application services.
- `src/cli/` — error class hierarchy + top-level handler.
- `src/cli.ts` — root program (`buildProgram()` + `main()`).
- `src/templates/` — per-stack / per-architecture / per-integration-category Handlebars templates and Claude prompts.
- `tests/{unit,integration,e2e}/` — Jest projects, one matcher per directory.

## Coding conventions

- TypeScript strict mode (`tsc --noEmit` must pass).
- No `var` — use `const` / `let`.
- Constructor injection only — services accept `deps` and `options` objects.
- Stable IDs (`FR-NNN`, `NFR-NNN`, `ADR-NNN`, `RISK-NNN`, `SH-NNN`, `INT-NNN`, `AC-FR-NNN-N`) for user-visible items; UUIDv7 for internal/technical IDs.
- AAA pattern in tests (`// arrange`, `// act`, `// assert`).
- ESLint + Prettier — `npm run lint` / `npm run format` before committing.

## Test gates

Coverage thresholds (enforced by Jest):

| Folder | Lines | Statements | Branches | Functions |
|---|---|---|---|---|
| `src/domain/` | ≥ 90% | ≥ 88% | ≥ 70% | ≥ 80% |
| `src/adapters/` | ≥ 75% | ≥ 75% | ≥ 60% | ≥ 75% |
| `src/application/` | ≥ 85% | ≥ 85% | ≥ 65% | ≥ 90% |
| `src/utils/` | ≥ 95% | ≥ 95% | ≥ 95% | ≥ 95% |

Run all gates locally:

```bash
npm run lint
npm run type-check
npm test
npm run test:coverage
npm run build
```

## Pull request flow

1. Branch from `main` (or the latest phase branch when work is in flight). Use a short, kebab-case name: `feat/...`, `fix/...`, `docs/...`.
2. Keep PRs small and focused. One topic per PR.
3. Update `README.md` and `CHANGELOG.md` (`Unreleased` section, Keep a Changelog format) when behaviour changes.
4. CI must be green before review (lint + type-check + tests + coverage).
5. Reference any related issues in the description; explain *why*, not just *what*.

## Reporting issues

When filing a bug:

- Node version (`node -v`) and OS.
- Provider in use (`cli` or `api`); for `cli`, output of `claude --version`.
- Steps to reproduce, expected vs. actual behaviour.
- If it's a generation bug, the relevant `.sdd/*.json` content (redact secrets).

## Adding a new integration category

1. Create `src/templates/integrations/<category>/prompts/brainstorm.prompt`.
2. (If the category has a diagram) add `src/templates/integrations/<category>/diagram.hbs`.
3. Register the category descriptor + Zod `extra` schema in `src/domain/IntegrationCategoryRegistry.ts`.
4. Add a unit test exercising `validateExtra(category, extra)` for both happy and rejection paths.
5. Update README's category list.

## Adding a new requirement importer

1. Implement `src/adapters/req-importers/<Format>RequirementImporter.ts` against `IRequirementImporter`.
2. Wire it into `src/commands/import.command.ts` under `--from <format>`.
3. Add a unit test in `tests/unit/RequirementImporters.test.ts`.

## Releasing (maintainers only)

1. Confirm all CI gates green on `main`.
2. Bump version in `package.json` (semver).
3. Move `Unreleased` items in `CHANGELOG.md` to a new dated version section.
4. `npm publish --dry-run` — inspect file list.
5. `npm publish`.
6. Tag the commit (`git tag vX.Y.Z && git push --tags`) and cut a GitHub Release with the changelog excerpt.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
