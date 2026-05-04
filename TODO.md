# TODO — sdd-generator implementation

> Источник истины: [SDD_CREATOR.md](./SDD_CREATOR.md). Завершённые задачи помечать ✅ (не `[x]`).
>
> Глобальные правила (из CLAUDE.md): hexagonal architecture, DDD where applicable, no `var`, constructor injection only, UUIDv7 for PKs, AAA pattern in tests.

---

## Phase 1 — Project Setup ✅

- ✅ `npm init` + `git init`, добавить `.gitignore` (node_modules, dist, .env, .sdd/cache)
- ✅ `package.json`: deps — `commander`, `inquirer`, `@anthropic-ai/sdk`, `handlebars`, `winston`, `zod`, `uuid` (v7), `chalk`, `ora`
- ✅ dev-deps — `typescript`, `ts-node`, `jest`, `ts-jest`, `@types/*`, `eslint`, `@typescript-eslint/*`, `prettier`
- ✅ `tsconfig.json` (strict mode, `target: ES2022`, `moduleResolution: node16`)
- ✅ `jest.config.js` (ts-jest preset, projects: unit / integration / e2e)
- ✅ `.eslintrc.json` + `.prettierrc.json`
- ✅ npm scripts: `dev`, `build`, `start`, `test`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `test:watch`, `lint`, `lint:fix`, `format`, `type-check`
- ✅ `bin` в `package.json` → `dist/cli.js`; добавить shebang `#!/usr/bin/env node` в `cli.ts`
- ✅ Создать каркас директорий: `src/{commands,application,domain,adapters,ports,utils,templates,types}`, `src/templates/{stacks,architectures,integrations,base}`, `tests/{unit,integration,e2e,fixtures}`
- ✅ `.env.example` с обоими провайдерами (см. Environment Setup в SDD_CREATOR.md)
- ✅ CI baseline: GitHub Actions для lint + type-check + test на PR

---

## Phase 2 — Domain & Adapters (foundation) ✅

### 2.1 Types & Domain Models ✅

- ✅ `src/types/index.ts` — re-export всего публичного API
- ✅ `src/domain/models.ts` — типы: `ProjectConfig`, `Requirement`, `AcceptanceCriterion`, `Risk`, `NFR`, `ADR`, `Stakeholder`, `GlossaryTerm`, `Integration`, `Stack`, `Architecture`, `IntegrationCategory`
- ✅ `schemaVersion: number` во всех корневых документах (config / requirements / integrations)
- ✅ Stable ID-генератор: `FR-001`, `NFR-001`, `ADR-001`, `RISK-001`, `INT-001`, `AC-<FR>-N` (увеличиваемые, без gap'ов)
- ✅ UUIDv7 для технических ID (cache, file refs); stable IDs выше — для пользовательских

### 2.2 Ports ✅

- ✅ `src/ports/IFileRepository.ts` — `read/write/exists/mkdir/remove/list`, типизированные ошибки (`FileNotFoundError`, `PermissionError`)
- ✅ `src/ports/IClaudeProvider.ts` — `complete(prompt, opts): Promise<string>`, `completeJson<T>(prompt, schema, opts): Promise<T>`, `countTokens?`
- ✅ `src/ports/ILogger.ts` — `debug/info/warn/error`, structured fields
- ✅ `src/ports/IIntegrationImporter.ts` — `canImport(format)`, `import(file): Promise<Integration[]>`
- ✅ `src/ports/ITemplateEngine.ts` — `render(template, ctx): string`, `registerHelper`, `registerPartial`

### 2.3 Adapters ✅

- ✅ `src/adapters/FileRepository.ts` — `fs/promises`, обработка ENOENT → `FileNotFoundError`
- ✅ `src/adapters/ClaudeApiAdapter.ts` — `@anthropic-ai/sdk`, retry с экспонентой на 429 (читать `Retry-After`), bounded retry на 5xx
- ✅ `src/adapters/ClaudeCliAdapter.ts` — `child_process.execFile('claude', ['-p', prompt, '--output-format', 'json'])`, без shell, таймаут (`SDD_CLAUDE_CLI_TIMEOUT_MS`, default 120s), парсинг JSON stdout
- ✅ `ClaudeCliNotInstalledError` (бинарника нет в PATH / `SDD_CLAUDE_CLI_BIN`) — сообщение: `npm i -g @anthropic-ai/claude-code`
- ✅ `ClaudeCliAuthError` (нужна авторизация) — сообщение: `claude login`
- ✅ `src/adapters/ClaudeProviderFactory.ts` — выбор по `config.claude.provider` (override: `--provider` flag → env `SDD_CLAUDE_PROVIDER` → config → default `cli`)
- ✅ Кэш-обёртка `CachingClaudeProvider` (decorator) — ключ `hash(model + prompt + opts)`, on-disk в `.sdd/cache/`, TTL опционально
- ✅ `src/adapters/HandlebarsTemplateEngine.ts` — компиляция + кэш скомпилированных шаблонов
- ✅ Custom helpers: `eq`, `ne`, `join`, `formatDate`, `lower`, `upper`, `markdownTable`, `mermaidEscape`
- ✅ `src/adapters/WinstonLogger.ts` — JSON формат, redaction для prompt-полей и API-ключей
- ✅ `src/adapters/importers/OpenApiImporter.ts`, `AsyncApiImporter.ts`, `BpmnImporter.ts` (stub'ы; реализация — Phase 4.5.3)

### 2.4 Domain Services ✅

- ✅ `src/domain/ConfigManager.ts` — load/save `.sdd/config.json`, валидация Zod
- ✅ `src/domain/RequirementValidator.ts` — Zod-схемы per-topic, проверка стабильных ID, ссылочной целостности
- ✅ `src/domain/IntegrationCatalog.ts` — CRUD над `integrations[]`, генерация `INT-NNN`, валидация per-category схем
- ✅ `src/domain/PromptBuilder.ts` — собирает контекст (config + already-collected sections) и тело prompt'а из шаблона
- ✅ `src/domain/StatusTracker.ts` — `completed | skipped | stale`; логика `stale` (что-то изменилось → зависимая секция помечается)
- ✅ `src/domain/CompletenessLinter.ts` — правила (FR без AC, NFR без measurable target, нерезолвлящиеся ID, mermaid parse, glossary coverage)
- ✅ `src/utils/validators.ts` — Zod-схемы (re-export); `src/utils/constants.ts` (env keys, defaults), `src/utils/config.ts` (env + .env loader)

### 2.5 Tests for Phase 2 ✅

- ✅ `tests/unit/ConfigManager.test.ts`, `RequirementValidator.test.ts`, `IntegrationCatalog.test.ts`, `PromptBuilder.test.ts`, `StatusTracker.test.ts`, `CompletenessLinter.test.ts`
- ✅ `tests/integration/FileRepository.test.ts` (через tmpdir)
- ✅ `tests/unit/ClaudeApiAdapter.test.ts` (mock SDK), `ClaudeCliAdapter.test.ts` (mock `execFile` + fixture stdout)
- ✅ `tests/unit/ClaudeProviderFactory.test.ts` (precedence flag>env>config>default)
- ✅ Coverage target: domain lines 80% (gate enforced), adapters lines 60% (gate enforced)

---

## Phase 3 — `init` Command ✅

- ✅ `src/application/InitService.ts` — создаёт `.sdd/{config.json,requirements.json,integrations.json}`, копирует stack/arch templates
- ✅ При `provider=cli` — probe `claude --version`; если не найден или нет авторизации — печатать понятную инструкцию и **продолжить** (init не должен валиться)
- ✅ `src/commands/init.command.ts` — inquirer flow (см. Phase 3 в SDD_CREATOR.md): провайдер → язык → фреймворк → архитектура → технологии → метаданные
- ✅ Идемпотентность: при существующем `.sdd/` — `--force` overwrite, `--merge` keep-existing, default abort
- ✅ `tests/integration/InitService.test.ts` — temp dir, проверка структуры файлов, корректного `claude.provider` в config
- ✅ e2e smoke: `sdd init --non-interactive --config fixtures/init.json`

---

## Phase 4 — `brainstorm` Command (10 этапов) ✅

### 4.1 Каркас ✅

- ✅ `src/application/BrainstormService.ts` — общий runner для всех этапов
- ✅ `src/commands/brainstorm.command.ts` — Commander sub-commands per topic
- ✅ Каждый этап:
  - свой prompt-файл `src/templates/base/brainstorm/<topic>.prompt` (с per-stack override через `src/templates/stacks/<stack>/prompts/brainstorm-<topic>.prompt`, через `PromptLoader`)
  - своя Zod-схема под секцию (`src/domain/BrainstormSchemas.ts`)
  - результат пишется под отдельный ключ в `requirements.json` через `RequirementsMerger`, остальные секции не трогаются
- ✅ Флаг `--skip` на каждом этапе → `status: "skipped"` + `skippedAt`
- ✅ Авто-постановка `status: "stale"` для зависимых секций при изменениях (`StatusTracker.propagateStaleness`)
- ✅ Парсинг JSON ответа через `IClaudeProvider.completeJson(prompt, schema)`; уточняющие вопросы (multi-turn) — отложены на 5.5/`sdd add`

### 4.2 Этапы (по одному файлу промпта + теста на каждый) ✅

- ✅ `stakeholders` — personas, roles, owners
- ✅ `context` — problem statement, цели, KPIs, бюджет, дедлайны
- ✅ `constraints` — регуляторика (GDPR/HIPAA/PCI), tech limits, assumptions
- ✅ `glossary` — ubiquitous language (DDD)
- ✅ `features` — use cases, FR-NNN, acceptance criteria, связь `usesIntegrations: ["INT-*"]`
- ✅ `domain` — bounded contexts, агрегаты, value objects, domain events (DDD)
- ✅ `quality` — измеримые NFR (`p95 < 200ms @ 1000 RPS`, `RTO 15m`, `RPO 5m`)
- ✅ `dependencies` — линковка к каталогу интеграций (через `IntegrationCatalog.ids()`)
- ✅ `anti` — out-of-scope items
- ✅ `compliance` — security & compliance requirements

### 4.3 Tests ✅

- ✅ `tests/integration/BrainstormService.test.ts` (stub `IClaudeProvider` per topic, проверка persist + ID assignment + staleness + skip)
- ✅ `tests/unit/RequirementsMerger.test.ts` + `tests/unit/PromptLoader.test.ts`

---

## Phase 4.5 — `integrations` Command (отдельный жизненный цикл) ✅

### 4.5.1 Service & commands ✅

- ✅ `src/application/IntegrationsService.ts` — `add`, `list`, `show`, `edit`, `remove`, `validate`, `import`, `generateSpec`
- ✅ `src/commands/integrations.command.ts` — Commander sub-commands (`list | show <id> | add | edit <id> | remove <id> | validate | spec | import --from <fmt> --file <path>`)
- ✅ Хранение: отдельный артефакт `.sdd/integrations.json` (`schemaVersion`, `integrations: []`)

### 4.5.2 Per-category presets ✅

Для каждой создан `src/templates/integrations/<category>/prompts/brainstorm.prompt` (+ `diagram.hbs` для bpms/message-broker/database). Per-category Zod-схемы для `extra` живут в `src/domain/IntegrationCategoryRegistry.ts`.

- ✅ `bpms` (Camunda 7/8 Zeebe, Flowable, Temporal, Conductor) — diagram + extras (processes, jobWorkers, correlationKeys, sagas, retention, versioning, bpmnFile)
- ✅ `message-broker` (RabbitMQ, Kafka, NATS, ActiveMQ, SQS/SNS, Pub/Sub) — diagram + extras (topics/exchanges, partitioning, ordering, delivery, deadLetter, retention, consumerGroups, backpressure)
- ✅ `database` (PostgreSQL, MySQL, MongoDB, Cassandra, ClickHouse) — diagram + extras (engine, readWriteSplit, replication, migrations, pooling, sharding, schemaSnippet)
- ✅ `cache` (Redis, Memcached, Hazelcast)
- ✅ `search` (Elasticsearch, OpenSearch, Meilisearch)
- ✅ `identity` (Keycloak, Auth0, Okta, Cognito)
- ✅ `storage` (S3, MinIO, GCS, Azure Blob)
- ✅ `observability` (Prometheus, Grafana, Loki, Jaeger, Datadog)
- ✅ `payment` (Stripe, PayPal, YooKassa)
- ✅ `notification` (Twilio, SendGrid, FCM, APNs)
- ✅ `external-api` (REST/GraphQL/gRPC)
- ✅ `legacy` (SOAP / mainframe)
- ✅ `custom`
- ✅ `_base/{overview.hbs, cross-cutting.hbs, traceability.hbs, section.hbs}` — общие секции

### 4.5.3 Importers ✅

- ✅ `OpenApiImporter` — JSON OpenAPI → `external-api` (servers, operations)
- ✅ `AsyncApiImporter` — JSON AsyncAPI → `message-broker` (channels, protocol, consumer groups)
- ✅ `BpmnImporter` — BPMN-XML → `bpms` (processes, userTasks, serviceTasks, events; regex-based, без новых deps)

### 4.5.4 Tests ✅

- ✅ `tests/unit/IntegrationCatalog.test.ts` — уже существовал (Phase 2)
- ✅ `tests/unit/IntegrationCategoryRegistry.test.ts` — descriptors + per-category extras validation
- ✅ `tests/unit/Importers.test.ts` — OpenAPI / AsyncAPI / BPMN
- ✅ `tests/integration/IntegrationsFlow.test.ts` — end-to-end add → list → show → import → spec, plus validate warning

---

## Phase 5 — `spec` Command ✅

### 5.1 Core 8 секций ✅

- ✅ `src/application/SpecService.ts` с методами: `generateExecutiveSummary`, `generateProductRequirements`, `generateSystemArchitecture`, `generateDetailedDesign`, `generateQualityAttributes`, `generateTestingStrategy`, `generateDeploymentOps`, `generateImplementationPlan`

### 5.2 Extended секции (arc42 / IEEE 29148) ✅

- ✅ Stakeholders & Personas
- ✅ Glossary (auto-build из `requirements.json`)
- ✅ C4 Context (L1) — авто из `integrations[]` (каждый INT-* = внешний узел)
- ✅ C4 Container (L2) — Claude prompt + Mermaid validator
- ✅ C4 Component (L3) — Claude prompt + Mermaid validator
- ✅ Domain Model — Mermaid class diagram (auto from aggregates)
- ✅ Data Model — Claude narrative + ER fallback из aggregates
- ✅ API Contracts — Claude narrative + refs к интеграциям
- ✅ Integrations Catalog — таблица + ссылка на `INTEGRATIONS.md`
- ✅ Key Sequence Diagrams (Mermaid; Claude per feature, fallback на default)
- ✅ ADR Log
- ✅ Risks Register (Likelihood × Impact × Mitigation × Owner)
- ✅ SLA / SLO / SLI
- ✅ Observability Plan (logs / metrics / traces / alerts / dashboards)
- ✅ Capacity & Scaling
- ✅ Cost Model
- ✅ Disaster Recovery (RTO / RPO / runbook)
- ✅ Migration & Rollback
- ✅ Change Management (canary / blue-green / feature flags)
- ✅ Traceability Matrix (FR → AC → integrations)

### 5.3 Diagram generation ✅

- ✅ `generateDiagram(kind)` — kinds: `c4-context | c4-container | c4-component | domain | er | sequence | bpmn | broker-topology` (BPMN: `MermaidDiagramBuilder.bpmnFlow()` рендерит processes / serviceTasks / userTasks из bpms-интеграций; `BpmnImporter` отдельно импортит .bpmn-XML в каталог интеграций)
- ✅ Валидация Mermaid синтаксиса (`MermaidValidator`: header whitelist + balanced-brackets — без новых deps)
- ✅ Re-prompt при невалидном Mermaid (default 2 попытки), иначе — `%% TODO: human review` маркер
- ✅ Sanitize-pass над финальным markdown'ом — невалидные блоки помечаются `<!-- TODO: human review -->`

### 5.4 Skipped & placeholders ✅

- ✅ Default: пропущенные секции исключаются (`status: 'skipped'` → markdown пустой)
- ✅ `--placeholders` флаг → рендерить `> ⏭ Section skipped — run sdd add <topic>...` через `placeholder.hbs`

### 5.5 Output ✅

- ✅ Default output: `docs/SDD.md` (`DEFAULTS.outputSddFile`)
- ✅ `sdd integrations spec` пишет `docs/INTEGRATIONS.md` отдельно (Phase 4.5)
- ✅ В основной SDD — сводная таблица интеграций + ссылка на `INTEGRATIONS.md`

### 5.6 Tests ✅

- ✅ `tests/integration/SpecService.test.ts` — fixtures + проверка всех 14 секций, skipped/placeholders, custom outputPath, generateDiagram dispatch
- ✅ `tests/unit/MermaidValidator.test.ts`, `tests/unit/MermaidDiagramBuilder.test.ts`
- ✅ Golden tests: эталонные SDD на demo-проектах (`tests/integration/SpecService.golden.test.ts` со снапшотами для `loan-service`, `simple-cli-tool`, `event-platform`; фикстуры в `tests/fixtures/demo-projects/<project>/{config,requirements,integrations}.json`)

---

## Phase 5.5 — Skip & Resume / Status / Add / Edit / Remove ✅

- ✅ `sdd status` — таблица completed/skipped/stale + counts + nextCommand (`StatusService` + `--json` mode)
- ✅ `sdd add <topic>` — алиас на `sdd brainstorm <topic>` через `lifecycle.command.ts`
- ✅ `sdd add feature` / `add adr` / `add risk` — гранулярные добавления через `RequirementsItemService` (FR-NNN/ADR-NNN/RISK-NNN авто-IDs, JSON payload через `--input`)
- ✅ `sdd edit <topic>` — re-run brainstorm поверх существующих данных
- ✅ `sdd remove <topic>` — `sdd brainstorm <topic> --skip` под капотом
- ✅ `sdd add integration [--category <cat>]` — алиас на `integrations add` (через `--input`)
- ✅ Tests: `tests/integration/StatusService.test.ts`, `tests/integration/RequirementsItemService.test.ts`

---

## Phase 5.6 — `lint` ✅

- ✅ `sdd lint` (default) — warnings + errors через `LintService` + `CompletenessLinter`
- ✅ `sdd lint --strict` — skipped секции и arc42-coverage становятся errors
- ✅ Проверки:
  - ✅ FR без acceptance criteria → error (`fr-without-ac`)
  - ✅ NFR без measurable target → error (`nfr-without-target`)
  - ✅ Все ID разрешаются → error (`unresolved-reference`)
  - ✅ Mermaid blocks парсятся → error (`mermaid-invalid`, через `MermaidValidator.extractFenced` + validate)
  - ✅ Glossary terms используются в тексте → warning (`glossary-unused`)
  - ✅ Skipped sections → warning (или error в strict)
  - ✅ INT без `secretsRef` → warning (`integration-missing-secrets-ref`)
  - ✅ Coverage по чек-листу arc42 (10 секций) → error в strict
- ✅ Exit code: 0 / 1 (errors) / 2 (warnings only); `--warnings-as-errors` промоутит 2→1
- ✅ Tests: `tests/integration/LintService.test.ts` (5 cases)

---

## Phase 5.7 — Update mode / Export / Import / Migrate ✅

- ✅ `sdd spec --update` — diff-режим через `.sdd/spec-cache.json` (per-section inputsHash; неизменённые секции переиспользуются)
- ✅ `sdd spec --format pdf|html|confluence` — `PandocExporter` (HTML/PDF через `pandoc -t html5` / `--pdf-engine=wkhtmltopdf`); `ConfluenceExporter` — stub с понятной ошибкой
- ✅ `sdd integrations spec --format pdf|html|confluence` — реализован поверх `generateIntegrationsSpec` через те же `PandocExporter` / `ConfluenceExporter`; добавлен `--export-path` override; покрыт `tests/integration/IntegrationsSpecFormat.test.ts`
- ✅ `sdd import --from jira|linear|md` — `MarkdownRequirementImporter` (полный парсер `## FR-NNN ... ### Acceptance`), `JiraJsonImporter` / `LinearJsonImporter` (JSON-export readers + priority mapping)
- ✅ `sdd integrations import --from openapi|asyncapi|bpmn <file>` (Phase 4.5.3)
- ✅ `sdd migrate` — `Migrator` с registry миграционных шагов (v1 → v1 noop сейчас, расширяемо для будущих версий); `--dry-run` flag
- ✅ Industry templates — `init --industry fintech|healthcare|e-commerce` пре-заполняет `compliance.items` (PCI-DSS / HIPAA / GDPR-CCPA presets)
- ✅ Tests: `tests/unit/Migrator.test.ts`, `tests/unit/RequirementImporters.test.ts`, `tests/integration/SpecServiceUpdateMode.test.ts`

---

## Phase 6 — Testing & Quality ✅

- ✅ Unit (`tests/unit/`) — domain 93.5% / adapters 81.8% / application 90.1% / utils 100% (gates подняты до 90/75/85/95 соответственно)
- ✅ Integration (`tests/integration/`) — `IFileRepository` живой через tmpdir во всех сервисных тестах; `IClaudeProvider` мокается через `StubClaudeProvider` (`SpecService.test.ts`, `BrainstormService.test.ts`, `IntegrationsFlow.test.ts`, etc.)
- ✅ E2E `tests/e2e/full-workflow.test.ts` — `init → integrations add → brainstorm features → spec → lint` end-to-end через мок-провайдер; +smoke `tests/e2e/init.test.ts` (Phase 3)
- ✅ Golden snapshot тесты — `tests/integration/SpecService.golden.test.ts` для `loan-service` / `simple-cli-tool` / `event-platform` (3 снапшота заморожены в `__snapshots__/`)
- ✅ Contract tests для портов — `tests/unit/contracts/{IFileRepository,IClaudeProvider,ITemplateEngine,ILogger}.contract.test.ts` (38 тестов; FS-impl + in-memory; Winston + capturing logger)
- ✅ Дополнительные unit-тесты: `RequirementValidator` (60%→100%), `utils/{config,uuid,validators}` (→100%), `ports/errors` (→88%), `exporters/{Pandoc,Confluence}` (→81% adapters)
- ✅ CI: lint + type-check + tests + coverage gate (jest.config.js: domain≥90, adapters≥75, application≥85, utils≥95)

---

## Phase 7 — CLI Integration ✅

- ✅ `src/cli.ts` — корневая Commander-программа: `buildProgram()` factory + `main(argv)` async entry, top-level catch вызывает `handleCliError`, `if (require.main === module)` shim для запуска из `dist/cli.js`
- ✅ Глобальные опции: `--verbose` (preAction hook ставит `LOG_LEVEL=debug`), `--provider <cli|api>` (preAction ставит `SDD_CLAUDE_PROVIDER`), `--help`, `--version`
- ✅ Регистрация команд: `init`, `brainstorm`, `integrations`, `spec`, `status`, `add`, `edit`, `remove`, `lint`, `import`, `migrate` — все 11 sub-команд проверены тестом `tests/integration/cli.program.test.ts`
- ✅ Кастомные error classes (`src/cli/errors.ts`): `SddCliError` (base) → `ValidationError` (2) / `LintFailedError` (2) / `ProviderInvocationError` (3) / `FileSystemError` (4); `EXIT_CODES = {success:0, generic:1, validation:2, provider:3, filesystem:4}`. `classifyError()` мапит порт-уровневые ошибки (`ClaudeCliNotInstalledError`, `ClaudeCliAuthError`, `ClaudeApiAuthError`, `ClaudeProviderError`, `FileNotFoundError`, `PermissionError`, `JsonParseError`, ZodError) → CLI-уровневые с готовыми hint-ами (e.g. "Run: claude login", "Run `sdd init`...")
- ✅ `--verbose` печатает stack traces; без флага — `✖ <message>` + `→ <hint>` + подсказка `(run with --verbose for stack trace)`. `lint.command` теперь бросает `LintFailedError` вместо `process.exit`, чтобы вошло в общий error handler
- ✅ `src/index.ts` — public API: domain models, application services (Init/Brainstorm/Spec/Lint/Status/IntegrationsService/RequirementsItemService), adapters (FileRepository/HandlebarsTemplateEngine/WinstonLogger/Claude*), все ports + port errors, CLI surface (`SddCliError`, `EXIT_CODES`, `classifyError`, `handleCliError`, `buildProgram`, `main`)
- ✅ Tests: `tests/unit/cli/errors.test.ts` (19 cases — exit codes, all classify branches, ZodError-name detection), `tests/unit/cli/handler.test.ts` (5 cases — output format, verbose stack), `tests/integration/cli.program.test.ts` (3 cases — command surface, --verbose hook, --provider hook)

---

## Phase 8 — Build & Package ✅ (готов к публикации; сам `npm publish` оставлен на usera)

- ✅ `npm run build` — компиляция в `dist/` через `tsconfig.build.json` + `scripts/copy-assets.js` копирует `src/templates/**` (stacks / architectures / integrations / spec / base) в `dist/templates/`
- ✅ `.npmignore` — `src/`, `tests/`, `coverage/`, `.sdd/`, `.github/`, `scripts/`, `docs/`, `*.tsbuildinfo`, eslint/prettier/jest configs, `TODO.md` / `SDD_CREATOR.md` / `CLAUDE.md` / `CONTRIBUTING.md`, `.env*`, `*.tgz`, `.idea/` / `.vscode/`
- ✅ `bin: { sdd, sdd-generator } → dist/cli.js`; shebang `#!/usr/bin/env node` сохраняется через TypeScript (первая строка `src/cli.ts` копируется как есть)
- ✅ `README.md` — финальный review: статус-баннер обновлён до "Phase 8 готова", команды и опции описаны, секция "Выбор Claude provider" актуальна
- ✅ `LICENSE` (MIT, copyright 2026 Eldar Sagitov)
- ✅ `CONTRIBUTING.md` — quick start, project layout (hexagonal layers), coding conventions (no `var`, constructor injection, stable IDs, AAA), test gates таблица, PR flow, integration/importer extension recipes, release flow для maintainers
- ✅ `CHANGELOG.md` (Keep a Changelog 1.1.0 + SemVer): `Unreleased` + `0.1.0 — 2026-05-04` с разбивкой по Phase 1-7
- ✅ `package.json` — добавлены `homepage`, `repository`, `bugs` URLs (https://github.com/Salvadore1987/sdd-creator); `files` теперь включает `CHANGELOG.md`; `prepublishOnly` уже стоит (`lint && type-check && test && build`)
- ✅ `npm pack --dry-run` — артефакт `sdd-generator-0.1.0.tgz`, **223 файла**, package size ≈ 93.5 kB / unpacked ≈ 473.6 kB; топ-уровень: `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json`, `dist/**` (с `dist/cli.js` shebang'ом и всеми `dist/templates/**`)
- ⏸ `npm publish` — оставлено на user (нужен залогиненный npm account; `npm pack --dry-run` зелёный, `prepublishOnly` пропускает lint+type-check+test+build)
- ⏸ GitHub Release с changelog — оставлено на user (требует push tag + интерактив с GitHub; команда: `gh release create v0.1.0 --notes-file CHANGELOG.md`)

---

## Cross-cutting ✅

- ✅ **Документация:** все 5 ADR'ов написаны в `docs/adr/`:
  - ✅ [ADR-001](./docs/adr/ADR-001-hexagonal-architecture.md) — Hexagonal architecture (ports & adapters)
  - ✅ [ADR-002](./docs/adr/ADR-002-handlebars-templates.md) — Handlebars для рендеринга шаблонов
  - ✅ [ADR-003](./docs/adr/ADR-003-commander-cli.md) — Commander.js для CLI surface
  - ✅ [ADR-004](./docs/adr/ADR-004-zod-validation.md) — Zod для runtime schema validation
  - ✅ [ADR-005](./docs/adr/ADR-005-provider-abstraction.md) — Two Claude provider backends behind a single port
  - ✅ [docs/adr/README.md](./docs/adr/README.md) — index + how-to-add-new-ADR
- ✅ **Observability:** `WinstonLogger` пишет JSON, redaction для `prompt`, `system`, `apiKey`/`api_key`, `authorization`, `token` + env-key `ANTHROPIC_API_KEY` (см. `src/adapters/WinstonLogger.ts`); рекурсивный обход вложенных объектов; `--verbose` поднимает `LOG_LEVEL=debug` через preAction hook (Phase 7)
- ✅ **Security:**
  - ✅ API key только из env (`ANTHROPIC_API_KEY` через `pickEnv`); `config.json` хранит только `claude.provider` + `claude.model`, не секреты — проверено `tests/integration/InitService.test.ts`
  - ✅ `ClaudeCliAdapter` — `child_process.execFile('claude', ['-p', prompt, '--output-format', 'json'])`, **не** `exec`/shell — защита от injection через args array (см. `src/adapters/ClaudeCliAdapter.ts`)
  - ✅ `.gitignore`: `.env`, `.env.local`, `.env.*.local`, `.sdd/cache/`, `dist/`, `coverage/`, `*.log`, `.DS_Store`, `.idea/` — см. `.gitignore`
- ✅ **Performance:** `CachingClaudeProvider` декорирует любой `IClaudeProvider`, ключ `sha256(model + prompt + opts)` через `crypto`, on-disk в `.sdd/cache/<key>.json`; `sdd spec --update` ещё и кэширует целые секции по `inputsHash` (`.sdd/spec-cache.json`); тесты — `tests/unit/CachingClaudeProvider.test.ts`, `tests/integration/SpecServiceUpdateMode.test.ts`
- ✅ **i18n:** `ProjectConfig.language: 'en' | 'ru'` сохраняется в `.sdd/config.json` через `sdd init`; `PromptLoader` подхватывает per-stack overrides; язык prompt'ов настраивается на этапе `init` и читается каждым brainstorm/spec вызовом

---

## Definition of Done для v1.0.0

- ✅ Все 5 стеков (Java, Node, Python, Go, Rust) × 5 архитектур (hexagonal, layered, microservices, event-driven, monolith) — все 25 комбинаций рендерят непустые шаблоны через `InitService` (`tests/integration/InitMatrix.test.ts` — 25 кейсов через `it.each`)
- ✅ 13 категорий интеграций — `src/templates/integrations/{bpms,message-broker,database,cache,search,identity,storage,observability,payment,notification,external-api,legacy,custom}/` каждая с `prompts/brainstorm.prompt`; per-category Zod-схемы в `IntegrationCategoryRegistry` (`tests/unit/IntegrationCategoryRegistry.test.ts`); diagram'ы для bpms/message-broker/database
- ✅ Оба провайдера (`api`, `cli`) проходят smoke-тесты — `tests/unit/ClaudeApiAdapter.test.ts` (mock `@anthropic-ai/sdk` SDK + retry на 429/5xx), `tests/unit/ClaudeCliAdapter.test.ts` (mock `execFile` + JSON parsing + ENOENT/auth fallbacks); `ClaudeProviderFactory` precedence — `tests/unit/ClaudeProviderFactory.test.ts`
- ✅ `sdd lint` на demo-проекте `loan-service` возвращает 0 errors — `tests/integration/LoanServiceLintSmoke.test.ts` (warnings допускаются: no-rendered-spec, glossary-unused — exit code <3)
- ✅ Generated SDD проходит чек-лист arc42 (12 секций) — `tests/integration/Arc42Coverage.test.ts` ассертит присутствие всех 12 anchor-заголовков (`## 1. Executive Summary` … `## 14. Traceability`); golden snapshot'ы (`tests/integration/SpecService.golden.test.ts`) фиксируют точный markdown для трёх demo-проектов
- ⏸ `npm publish` успешен, `npx sdd-generator init` работает на чистой машине — `npm pack --dry-run` ✓ (artefact `sdd-generator-0.1.0.tgz`, 223 файла, 93.5 kB); `prepublishOnly` runs `lint && type-check && test && build`. Финальный `npm publish` оставлен на maintainer-а (нужен npm-account login).
