# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

This repo is **pre-implementation**. It currently contains only `SDD_CREATOR.md`, an 8-phase development plan for an unbuilt CLI tool. No `package.json`, `tsconfig.json`, source code, or git history exists yet. Treat `SDD_CREATOR.md` as the spec to implement — referenced docs (`SDD_GENERATOR_COMPLETE.md`, `IMPLEMENTATION_EXAMPLES.ts`, `TEMPLATE_EXAMPLES.md`, `CLAUDE_PROMPTS.md`) are mentioned in the plan but **not present in this repo**. If a task requires content from them, ask the user rather than fabricating.

## What's Being Built

`sdd-generator` — a Node.js/TypeScript CLI that drives spec-anchored development with the Claude API. Three commands:

- `init` — scaffolds a `.sdd/` project directory with config + requirements templates, picking stack (Java/Node/Python/Go/Rust) and architecture (hexagonal/layered/microservices/event-driven/monolith) via inquirer prompts.
- `brainstorm` — interactive loop: user describes a feature, Claude returns structured JSON (acceptance criteria, risks), result is appended to `.sdd/requirements.json`.
- `spec` — renders the accumulated requirements + stack/architecture templates (Handlebars) into a multi-section SDD markdown document.

## Architecture (target)

Hexagonal / ports-and-adapters. The layout in the spec is load-bearing — keep dependencies pointing inward:

- `src/ports/` — interfaces only (`IFileRepository`, `IClaudeProvider`, `ILogger`).
- `src/adapters/` — concrete implementations (`fs/promises`, `@anthropic-ai/sdk`, `winston`). Adapters depend on ports, never the other way.
- `src/domain/` — pure logic: `ConfigManager`, `RequirementValidator` (Zod schemas), `PromptBuilder`, `TemplateEngine` (Handlebars).
- `src/application/` — use-case services (`InitService`, `BrainstormService`, `SpecService`) orchestrating domain + ports.
- `src/commands/` — thin Commander.js wrappers that wire DI and call application services.
- `src/templates/{stacks,architectures}/` — per-stack and per-architecture Handlebars templates + Claude prompt files. Stack/architecture selection at runtime determines which template tree is loaded.

Runtime artifacts the tool produces in a user's project: `.sdd/config.json`, `.sdd/requirements.json`, and the generated SDD markdown (default `./docs/SDD.md`).

## Code Style

Per global rules: no `var`, constructor injection only, UUIDv7 for IDs, AAA pattern in tests. Tests split into `tests/unit/`, `tests/integration/`, `tests/e2e/` with Jest.

## Environment

Runtime expects `ANTHROPIC_API_KEY` and optional `LOG_LEVEL`, `SDD_GENERATOR_CACHE`, `SDD_GENERATOR_TEMPLATES_DIR`.

## Commands

None of the npm scripts referenced in `SDD_CREATOR.md` (`npm run dev`, `test`, `build`, `lint`, etc.) work yet because `package.json` does not exist. Phase 1 of the plan is to create it. Once present, the spec calls for: `npm run dev` (ts-node), `npm test` / `test:unit` / `test:integration` / `test:e2e` / `test:coverage` / `test:watch`, `npm run type-check`, `npm run lint:fix`, `npm run format`, `npm run build`.

## Plan mode
- Always show in console what you need to change

## Implementation
- After each phase need check checkbox to done
- Create commit whith message `git commit -am {generated message from tasks}`
