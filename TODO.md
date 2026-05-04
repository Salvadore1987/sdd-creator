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

## Phase 5 — `spec` Command

### 5.1 Core 8 секций

- [ ] `src/application/SpecService.ts` с методами: `generateExecutiveSummary`, `generateProductRequirements`, `generateSystemArchitecture`, `generateDetailedDesign`, `generateQualityAttributes`, `generateTestingStrategy`, `generateDeploymentOps`, `generateImplementationPlan`

### 5.2 Extended секции (arc42 / IEEE 29148)

- [ ] Stakeholders & Personas
- [ ] Glossary (auto-build из `requirements.json` + код)
- [ ] C4 Context (L1) — авто из `integrations[]` (каждый INT-* = внешний узел)
- [ ] C4 Container (L2)
- [ ] C4 Component (L3) — для ключевых контейнеров
- [ ] Domain Model — Mermaid class diagram
- [ ] Data Model — ER + миграции
- [ ] API Contracts — refs к OpenAPI/AsyncAPI
- [ ] Integrations Catalog — таблица + ссылка на `INTEGRATIONS.md`
- [ ] Key Sequence Diagrams (Mermaid)
- [ ] ADR Log
- [ ] Risks Register (Likelihood × Impact × Mitigation × Owner)
- [ ] SLA / SLO / SLI
- [ ] Observability Plan (logs / metrics / traces / alerts / dashboards)
- [ ] Capacity & Scaling
- [ ] Cost Model
- [ ] Disaster Recovery (RTO / RPO / runbook)
- [ ] Migration & Rollback
- [ ] Change Management (canary / blue-green / feature flags)
- [ ] Traceability Matrix (FR → design → test → код)

### 5.3 Diagram generation

- [ ] `generateDiagram(kind)` — kinds: `c4-context | c4-container | c4-component | domain | er | sequence | bpmn | broker-topology`
- [ ] Валидация Mermaid синтаксиса до записи (через `@mermaid-js/parser` или CLI)
- [ ] Re-prompt при невалидном Mermaid (max 2 попытки), иначе — `<!-- TODO: human review -->`
- [ ] BPMN — через `BpmnImporter` (если уже есть `.bpmn`) или генерация Claude

### 5.4 Skipped & placeholders

- [ ] Default: пропущенные секции исключаются
- [ ] `--placeholders` флаг → рендерить `> ⏭ Section skipped — run \`sdd add <topic>\`...`

### 5.5 Output

- [ ] Default output: `docs/SDD.md`
- [ ] `sdd integrations spec` пишет `docs/INTEGRATIONS.md` отдельно
- [ ] В основной SDD — только сводная таблица + ссылка на `INTEGRATIONS.md`

### 5.6 Tests

- [ ] `tests/integration/SpecService.test.ts` — fixtures `requirements.json` + `integrations.json`, проверка наличия каждой секции
- [ ] Golden tests: эталонные SDD на demo-проектах (`loan-service`, `simple-cli-tool`, `event-platform`)

---

## Phase 5.5 — Skip & Resume / Status / Add / Edit / Remove

- [ ] `sdd status` — таблица: что completed / skipped / stale, со ссылками на команды
- [ ] `sdd add <topic>` — запуск интерактива одного этапа
- [ ] `sdd add feature` / `add adr` / `add risk` — гранулярные добавления одной записи
- [ ] `sdd edit <topic>` — перезапуск интерактива поверх существующих данных
- [ ] `sdd remove <topic>` — вернуть в `skipped`
- [ ] `sdd add integration [--category <cat>]` — алиас на `integrations add`
- [ ] Tests: unit + integration на каждую под-команду

---

## Phase 5.6 — `lint`

- [ ] `sdd lint` (default) — warnings + errors
- [ ] `sdd lint --strict` — падает на skipped секциях
- [ ] Проверки:
  - [ ] FR без acceptance criteria → error
  - [ ] NFR без measurable target → error
  - [ ] Все ID разрешаются (`FR-099` в ADR не должен указывать в пустоту) → error
  - [ ] Mermaid blocks парсятся → error
  - [ ] Glossary terms используются в тексте → warning
  - [ ] Skipped sections → warning (или error в strict)
  - [ ] INT без `secretsRef` → warning
  - [ ] Coverage по чек-листу arc42 (12 секций) → error в strict
- [ ] Exit code: 0 / 1 (errors) / 2 (warnings only — для CI с `--warnings-as-errors`)

---

## Phase 5.7 — Update mode / Export / Import / Migrate

- [ ] `sdd spec --update` — diff-режим: регенерит только секции с изменившимся хэшем входов
- [ ] `sdd spec --format pdf|html|confluence` (post-process через `pandoc` / Confluence REST API)
- [ ] `sdd integrations spec --format pdf|html|confluence`
- [ ] `sdd import --from jira|linear|md` — подтянуть FR из внешних трекеров
- [ ] `sdd integrations import --from openapi|asyncapi|bpmn <file>`
- [ ] `sdd migrate` — миграция между `schemaVersion` (CLI обнаруживает разрыв и предлагает migrate)
- [ ] Industry templates — `--industry fintech|healthcare|e-commerce` пред-NFR + compliance вопросы

---

## Phase 6 — Testing & Quality

- [ ] Unit (`tests/unit/`) — domain ≥ 80%, adapters ≥ 60%
- [ ] Integration (`tests/integration/`) — `IFileRepository` живой через tmpdir, `IClaudeProvider` всегда мокается
- [ ] E2E (`tests/e2e/full-workflow.test.ts`) — `init → brainstorm features → integrations add → spec → lint`, через мок-провайдер
- [ ] Golden files для template output (snapshot тесты)
- [ ] Contract tests для портов
- [ ] CI: lint + type-check + tests + coverage gate

---

## Phase 7 — CLI Integration

- [ ] `src/cli.ts` — корневая Commander-программа
- [ ] Глобальные опции: `--verbose` (LOG_LEVEL=debug), `--provider <api|cli>`, `--help`, `--version`
- [ ] Регистрация команд: `init`, `brainstorm [topic]`, `integrations <sub>`, `spec`, `lint`, `status`, `add <topic>`, `edit <topic>`, `remove <topic>`, `import`, `migrate`
- [ ] Кастомные error classes → exit codes: 0 success, 1 generic error, 2 validation/lint, 3 provider error
- [ ] `--verbose` печатает stack traces; иначе — actionable user-facing messages
- [ ] `src/index.ts` — public API exports для использования как библиотека

---

## Phase 8 — Build & Package

- [ ] `npm run build` — компиляция в `dist/`, копирование `templates/` и `prompts/` (assets pipeline)
- [ ] `.npmignore` — исключить `tests/`, `src/`, `coverage/`, `.sdd/`
- [ ] `bin` указывает на `dist/cli.js` с shebang
- [ ] `README.md` уже есть — финальный review перед публикацией
- [ ] `LICENSE` (MIT)
- [ ] `CONTRIBUTING.md` — basic flow
- [ ] `CHANGELOG.md` (Keep a Changelog)
- [ ] `npm publish --dry-run` → проверить содержимое
- [ ] `npm publish`
- [ ] GitHub Release с changelog

---

## Cross-cutting (делать параллельно)

- [ ] **Документация:** ADR-001 (hexagonal), ADR-002 (Handlebars), ADR-003 (Commander), ADR-004 (Zod), ADR-005 (provider abstraction)
- [ ] **Observability:** структурное логирование с redaction prompt'ов и ключей
- [ ] **Security:**
  - API key только из env, никогда в `config.json`
  - В `ClaudeCliAdapter` — `execFile`, не `exec`/shell (защита от injection)
  - `.gitignore`: `.env`, `.sdd/cache/`
- [ ] **Performance:** cache по `hash(model + prompt + opts)`, повтор с теми же входами не жжёт токены/подписку
- [ ] **i18n:** язык prompts настраивается в `config.json` (`language: ru | en`), default — язык проекта

---

## Definition of Done для v1.0.0

- [ ] Все 5 стеков (Java, Node, Python, Go, Rust) × 5 архитектур (hexagonal, layered, microservices, event-driven, monolith) — каждая комбинация компилируется в работающий init template
- [ ] 13 категорий интеграций — у каждой есть prompts + schema + Handlebars-секция
- [ ] Оба провайдера (`api`, `cli`) проходят smoke-тесты
- [ ] `sdd lint` на demo-проекте `loan-service` возвращает 0 errors
- [ ] Generated SDD проходит чек-лист arc42 (12 секций)
- [ ] `npm publish` успешен, `npx sdd-generator init` работает на чистой машине
