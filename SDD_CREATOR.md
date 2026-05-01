# GETTING STARTED: SDD Generator Development

## 📚 What You Have

1. **SDD_GENERATOR_COMPLETE.md** (14 sections, ~20KB)
   - Complete specification with all requirements
   - Architecture, design, implementation plan
   - Testing strategy, deployment guide
   - **This is your source of truth!**

2. **package.json** - All dependencies configured
3. **tsconfig.json** - TypeScript configuration
4. **jest.config.js** - Test framework setup
5. **Code Examples** (IMPLEMENTATION_EXAMPLES.ts)
   - Ports/adapters interfaces
   - Service implementations
   - Repository patterns
6. **Templates** (TEMPLATE_EXAMPLES.md)
   - Java/Spring Boot examples
   - Node.js/NestJS examples
   - Python/FastAPI examples
   - Go examples
7. **Claude Prompts** (CLAUDE_PROMPTS.md)
   - Brainstorm system prompt
   - Spec generation prompt
   - Example interactions

---

## 📐 Scope of a Complete SDD

Цель инструмента — выдать SDD, проходящую чек-листы arc42 / IEEE 29148. Сводка того, что нужно собрать и сгенерировать.

### A. Inputs to Capture (через `init` + `brainstorm`)

Помимо проект-метаданных и features, инструмент должен в отдельных интерактивных этапах собрать:

1. **Stakeholders & Personas** — пользователи, заказчик, оператор.
2. **Business Context** — problem statement, цели, KPIs, бюджет, дедлайны.
3. **Constraints & Assumptions** — регуляторика (GDPR/HIPAA/PCI), технологические лимиты, зависимости.
4. **Glossary / Ubiquitous Language** — термины с определениями (DDD).
5. **Use Cases / User Journeys** — сценарии end-to-end, не только features.
6. **Bounded Contexts & Domain Model** — агрегаты, сущности, value objects, domain events (DDD).
7. **Quality Attribute Scenarios** — измеримые: "p95 < 200ms при 1000 RPS", "RTO 15 мин".
8. **External Dependencies & Integrations** — внешние API/системы, брокеры, оркестраторы, БД и их SLA. См. раздел "A.8 Integrations Catalog" ниже.
9. **Anti-requirements** — что **не** делаем (out of scope).
10. **Compliance & Security requirements** — отдельная ветка вопросов.

Каждому — своя Claude-prompt-стратегия и схема в `requirements.json`.

### A.8 Integrations Catalog (зависимые системы)

Отдельный first-class concept — каталог интегрируемых систем. Через `sdd add integration` (или этап `brainstorm dependencies`) пользователь описывает каждую систему-зависимость по единой схеме.

**Поддерживаемые категории (preset'ы с заточенными промптами):**

| Категория | Примеры |
|---|---|
| `bpms` / `workflow` | Camunda 7/8 (Zeebe), Flowable, Temporal, Conductor |
| `message-broker` | RabbitMQ, Kafka, NATS, ActiveMQ, AWS SQS/SNS, Google Pub/Sub |
| `cache` | Redis, Memcached, Hazelcast |
| `database` | PostgreSQL, MySQL, MongoDB, Cassandra, ClickHouse |
| `search` | Elasticsearch, OpenSearch, Meilisearch |
| `identity` | Keycloak, Auth0, Okta, AWS Cognito |
| `storage` | S3, MinIO, GCS, Azure Blob |
| `observability` | Prometheus, Grafana, Loki, Jaeger, Datadog |
| `payment` | Stripe, PayPal, YooKassa |
| `notification` | Twilio, SendGrid, FCM, APNs |
| `external-api` | произвольные REST/GraphQL/gRPC сервисы |
| `legacy` | внутренние SOAP/COBOL/мейнфрейм системы |
| `custom` | всё остальное |

**Единая схема `integration` в `requirements.json`:**

```json
{
  "id": "INT-001",
  "name": "Camunda BPMS",
  "category": "bpms",
  "vendor": "Camunda",
  "version": "8.5",
  "purpose": "Оркестрация процесса approve-loan: координирует шаги credit-check → underwriting → contract-sign",
  "direction": "bidirectional",            // inbound | outbound | bidirectional
  "criticality": "critical",                // critical | important | optional
  "protocol": "gRPC + REST",                // amqp | mqtt | kafka | rest | grpc | jdbc | jms | smtp | …
  "authMethod": "OAuth2 client-credentials",
  "dataFormat": "JSON / Protobuf",
  "topicsOrQueues": ["loan-approval-process"],   // для брокеров/BPMS — очереди/задачи/процессы
  "endpoints": ["zeebe.prod.example/grpc"],
  "sla": { "availability": "99.9%", "latencyP95Ms": 200 },
  "rateLimits": "100 RPS / client",
  "errorHandling": "retry exp backoff 3x, then DLQ → alert",
  "idempotency": "messageId-based dedup, 24h window",
  "transactions": "outbox pattern, eventual consistency",
  "fallback": "circuit breaker → degraded mode (без оркестрации, синхронный fallback)",
  "owner": "Platform Team",
  "docsUrl": "https://docs.camunda.io/...",
  "envs": { "dev": "...", "stage": "...", "prod": "..." },
  "secretsRef": "vault://camunda/prod",
  "compliance": ["GDPR: PII в payload запрещён"],
  "monitoring": ["metric: zeebe_jobs_activated", "alert: workflow-stuck > 5m"],
  "status": "completed"
}
```

**Что Claude должен спросить per-category (preset prompts):**

- **bpms (Camunda и др.)**: какие процессы (BPMN-модели), какие job workers, как стартует процесс, correlation keys, timer/message events, compensation/sagas, история и retention, версионирование процессов.
- **message-broker (Rabbit/Kafka)**: продьюсеры/консьюмеры, exchanges/topics, partitioning key, ordering guarantees, at-least-once vs exactly-once, DLQ, retention, consumer group strategy, backpressure.
- **database**: read/write split, репликация, миграционная стратегия (Flyway/Liquibase), connection pooling, шардирование.
- **identity**: realms/clients, scopes, token lifetime, refresh-стратегия, federation.
- **external-api**: rate limits, retry policy, idempotency, contract versioning, circuit breaker.

Каждый preset = `src/templates/integrations/<category>/prompts/brainstorm.prompt` + `schema.json`.

**Команды:**

```bash
sdd add integration                       # выбрать категорию из меню → preset prompts
sdd add integration --category bpms       # пропустить меню
sdd list integrations                     # таблица всех INT-*
sdd edit integration INT-001
sdd remove integration INT-001
```

### B. Output Sections (генерируются `spec`)

К базовым 8 (Executive Summary, Product Requirements, System Architecture, Detailed Design, Quality Attributes, Testing Strategy, Deployment & Operations, Implementation Plan) добавить:

11. **Stakeholders & Personas**
12. **Glossary**
13. **Context Diagram (C4 L1)** — Mermaid
14. **Container Diagram (C4 L2)** — Mermaid
15. **Component Diagram (C4 L3)** — для ключевых контейнеров
16. **Domain Model** — Mermaid class diagram, агрегаты и события
17. **Data Model** — ER-диаграмма + миграции
18. **API Contracts** — ссылки на OpenAPI/AsyncAPI, ключевые эндпоинты
18a. **Integrations Catalog** — таблица всех `INT-*` с категорией, протоколом, SLA, criticality; per-integration подсекции с деталями (BPMN-схемы для BPMS, topology для брокеров, ER-выдержки для БД), полученными в `A.8`
19. **Key Sequence Diagrams** — критические флоу (Mermaid)
20. **ADR Log** — architecture decisions с rationale
21. **Risks Register** — Likelihood × Impact × Mitigation × Owner
22. **SLA / SLO / SLI** — измеримые цели + способ замера
23. **Observability Plan** — logs, metrics, traces, alerts, дашборды
24. **Capacity & Scaling** — нагрузочные предположения
25. **Cost Model** — оценка инфры и третьих сервисов
26. **Disaster Recovery** — backup, RTO/RPO, runbook
27. **Migration & Rollback** — если заменяем существующую систему
28. **Change Management** — canary / blue-green / feature flags
29. **Traceability Matrix** — FR → design → test → код

### C. Generator Capabilities

- **Diagram generation** — Claude → Mermaid/PlantUML, валидация синтаксиса перед записью.
- **Stable IDs** — `FR-001`, `NFR-001`, `ADR-001`, `RISK-001`; автоссылки между секциями.
- **Traceability matrix** — генерится автоматически из ID-связей.
- **Completeness linter** (`sdd lint`):
  - каждый FR имеет acceptance criteria;
  - каждый NFR имеет измеримый target;
  - все термины glossary встречаются в тексте;
  - все ID разрешаются;
  - mermaid-блоки парсятся.
- **Diff/update mode** (`sdd spec --update`) — регенерит только изменённые секции.
- **Review markers** — `<!-- TODO: human review -->` там, где Claude не уверен.
- **Multi-format export** — markdown → HTML / PDF / Confluence (часть v1).
- **Industry templates** — fintech / healthcare / e-commerce с преднастроенными NFR и compliance.
- **Import** — подтянуть существующие requirements из JIRA/Linear/markdown.
- **Cache по content-hash** — повтор brainstorm с теми же входами не жжёт токены.
- **Versioning** — `schemaVersion` в `requirements.json` + `sdd migrate`.
- **Provider abstraction** — два бэкенда Claude через единый порт `IClaudeProvider`:
  - `cli` *(default)* — локальный Claude Code CLI (через `claude login`), для подписчиков Pro/Max/Team — без API-ключа, биллинг по подписке (console subscription);
  - `api` — Anthropic API (`ANTHROPIC_API_KEY`), для CI/скриптов и тех, у кого нет подписки.
  - Выбор: интерактивно в `init`, флагом `--provider`, или env `SDD_CLAUDE_PROVIDER`. Кэш и retry-логика общие.

### C.1 Skip & Resume (опциональные шаги, добавляемые позже)

Любой этап из A (входы) можно **пропустить** при первом прогоне и **добавить позже** отдельной командой. Это нужно, чтобы быстро получить черновую SDD и доращивать её итеративно.

**Поведение skip:**
- В каждом интерактивном этапе `brainstorm <topic>` — опция `Skip for now` (или флаг `--skip`).
- Пропущенный этап пишется в `requirements.json` как:
  ```json
  "stakeholders": { "status": "skipped", "skippedAt": "2026-05-01T..." }
  ```
- При генерации `spec` пропущенные секции:
  - либо **исключаются** из документа (default);
  - либо рендерятся как заглушка `> ⏭ Section skipped — run \`sdd add stakeholders\` to fill in.` (флаг `--placeholders`).
- `sdd lint` в режиме `--strict` падает на skipped, в обычном — выдаёт warning со списком и подсказкой команды.

**Команды для позднего добавления / правки:**

```bash
sdd status                      # что собрано / что skipped / что устарело
sdd add <topic>                 # запустить интерактив для одного этапа (stakeholders, glossary, …)
sdd edit <topic>                # перезапустить интерактив поверх существующих данных
sdd remove <topic>              # удалить секцию (вернуть в "skipped")
sdd add feature                 # добавить одну фичу, не запуская весь features-цикл
sdd add adr                     # зафиксировать architecture decision
sdd add risk                    # добавить запись в risks register
sdd spec --update               # после `add` — догенерить только новые/изменённые секции
```

**Контракт `requirements.json` для каждого topic:**

```json
{
  "schemaVersion": 1,
  "stakeholders": { "status": "completed" | "skipped" | "stale", "data": {...}, "updatedAt": "..." },
  "glossary":     { "status": "...", "data": {...} },
  "features":     { "status": "...", "data": [...] },
  ...
}
```

`status: "stale"` — выставляется автоматически, если связанная секция изменилась (например, добавили feature после glossary → glossary помечается `stale`, чтобы юзер мог `sdd edit glossary`).

### D. Definition of Complete SDD

- Формальный чек-лист (arc42 12 секций или IEEE 29148) — `sdd lint` его проверяет.
- **Quality bar** в `stack-config.json` — какие секции обязательны для данного стека/архитектуры.
- **Golden tests** — эталонные SDD на демо-проектах, проверяем воспроизводимость с заданным diff.

---

## 🚀 Quick Start (Development Order)

### Phase 1: Project Setup (2-3 hours)

```bash
# 1. Create project directory
mkdir sdd-generator
cd sdd-generator
git init

# 2. Copy package.json, tsconfig.json, jest.config.js
# (from provided files)

# 3. Install dependencies
npm install

# 4. Create directory structure
mkdir -p src/{commands,application,domain,adapters,ports,utils,templates}
mkdir -p src/templates/{stacks,architectures}
mkdir -p tests/{unit,integration,fixtures}

# 5. Create basic config files
touch .env.example
touch .eslintrc.json
touch .prettierrc.json
```

### Phase 2: Domain & Adapters (4-6 hours)

**Priority: Implement Foundation**

```typescript
// 1. src/types/index.ts
// Copy from provided types file
// Define all interfaces

// 2. src/ports/ (Interfaces)
// - IFileRepository.ts
// - IClaudeProvider.ts
// - ILogger.ts

// 3. src/adapters/ (Implementations)
// - FileRepository.ts (use fs/promises)
// - ClaudeApiAdapter.ts  (через @anthropic-ai/sdk, провайдер `api`)
// - ClaudeCliAdapter.ts  (через child_process + `claude -p ... --output-format json`,
//                         провайдер `cli` — для подписчиков Pro/Max)
// - ClaudeProviderFactory.ts (создаёт нужный адаптер по config.claude.provider)
// - WinstonLogger.ts (use winston)

// 4. src/utils/validators.ts
// - Create Zod schemas for ProjectConfig, Requirements
// - Validation helper functions

// 5. src/domain/
// - ConfigManager.ts
// - RequirementValidator.ts
// - PromptBuilder.ts
// - TemplateEngine.ts (use handlebars)
```

**Tests to write:**
```bash
npm run test:unit -- ConfigManager.test.ts
npm run test:unit -- FileRepository.test.ts
npm run test:unit -- PromptBuilder.test.ts
```

### Phase 3: Init Command (3-4 hours)

**File: src/application/InitService.ts**

```typescript
// 1. Create InitService class
// 2. Implement execute() method
// 3. Create directory structure (.sdd/)
// 4. Save config.json (включая claude.provider: 'api' | 'cli')
// 5. Save requirements.json template
// 6. Copy template.md (stack/arch-specific)
// 7. Если provider=cli — проверить наличие бинарника `claude`
//    и подсказать `claude login`, если нет авторизации.

// Tests:
npm run test:integration -- InitService.test.ts
```

**File: src/commands/init.command.ts**

```typescript
// 1. Define CLI command using commander.js
// 2. Create interactive prompts with inquirer.js
// 3. Map answers to InitAnswers type
// 4. Call InitService.execute()
// 5. Handle errors gracefully
```

**Interactive flow to implement:**

```
? Project name: user-service
? Project description: Authentication service...
? Version: 1.0.0
? Author name: Eldar
? Author email: eldar@example.com
? Claude provider:
  ❯ cli  — Claude Code CLI (default, console subscription Pro/Max/Team, через `claude login`)
    api  — Anthropic API (нужен ANTHROPIC_API_KEY)
? Select language:
  ❯ Java
    Node.js
    Python
    ...
? Select framework: [depends on language]
? Select architecture:
  ❯ Hexagonal
    Layered
    ...
? Select technologies: [multi-select]
? Team size: 5
? Complexity: medium
? Deadline: Q3 2026
? Additional notes: (optional)
```

### Phase 4: Brainstorm Command (4-5 hours)

**File: src/application/BrainstormService.ts**

```typescript
// 1. Load config from .sdd/config.json
// 2. Load existing requirements from .sdd/requirements.json
// 3. Interactive loop:
//    a. Get user input (feature description)
//    b. Build Claude prompt with context
//    c. Call Claude API
//    d. Parse response (should be JSON)
//    e. Ask clarifying questions (if needed)
//    f. Compile Requirement object
//    g. Save to requirements.json
//    h. Ask if continue

// Key Methods:
// - getUserInput(): Promise<string>
// - askClarifyingQuestions(claudeResponse): Promise<dict>
// - compileRequirement(): Requirement
// - generateFeatureId(): string  // FR-001, NFR-001, ADR-001, RISK-001 (stable IDs)
// - extractAcceptanceCriteria(): AcceptanceCriterion[]
// - identifyRisks(): Risk[]
```

**Расширенный brainstorm flow (под полную SDD):**

Brainstorm — это не один цикл по features, а серия суб-команд / этапов. См. раздел "Scope of a Complete SDD → A. Inputs to Capture":

```
sdd brainstorm stakeholders   # personas, roles, owners
sdd brainstorm context        # problem, goals, KPIs, deadlines
sdd brainstorm constraints    # regulatory, tech limits, assumptions
sdd brainstorm glossary       # ubiquitous language
sdd brainstorm features       # use cases, FRs, acceptance criteria  (текущий поток)
sdd brainstorm domain         # bounded contexts, aggregates, events (DDD)
sdd brainstorm quality        # measurable NFR scenarios (p95, RTO/RPO, …)
sdd brainstorm dependencies   # external systems + their SLAs
sdd brainstorm anti           # out-of-scope items
sdd brainstorm compliance     # security & compliance requirements
```

Альтернатива — единый `sdd brainstorm` с интерактивным меню выбора этапа. Каждый этап:
- свой prompt-файл в `src/templates/stacks/<stack>/prompts/brainstorm-<topic>.prompt`;
- свой Zod-schema под секцию в `requirements.json`;
- результат пишется под отдельный ключ (`stakeholders`, `glossary`, `nfrs`, …), не перезаписывая остальное.

**File: src/commands/brainstorm.command.ts**

```typescript
// 1. Load .sdd/config.json (verify it exists)
// 2. Create IClaudeProvider via ClaudeProviderFactory (по config.claude.provider)
// 3. Create BrainstormService
// 4. Call execute()
// 5. Display saved features
```

**Prompts location:**
```
src/templates/stacks/{java,nodejs,python}/prompts/
├── brainstorm.prompt
└── spec-generate.prompt
```

**Copy prompts from CLAUDE_PROMPTS.md into these files**

### Phase 5: Spec Command (6-8 hours)

**File: src/application/SpecService.ts**

```typescript
// 1. Load config and requirements
// 2. Validate (optional)
// 3. Select templates based on stack/architecture
// 4. Generate each SDD section:
//    Core 8:
//    - Executive Summary
//    - Product Requirements
//    - System Architecture
//    - Detailed Design
//    - Quality Attributes
//    - Testing Strategy
//    - Deployment & Operations
//    - Implementation Plan
//    Extended (полная SDD по arc42 / IEEE 29148):
//    - Stakeholders & Personas
//    - Glossary
//    - C4 Context / Container / Component Diagrams (Mermaid)
//    - Domain Model (Mermaid class diagram)
//    - Data Model (ER + миграции)
//    - API Contracts (OpenAPI/AsyncAPI refs)
//    - Key Sequence Diagrams (Mermaid)
//    - ADR Log
//    - Risks Register (Likelihood × Impact × Mitigation × Owner)
//    - SLA / SLO / SLI
//    - Observability Plan (logs, metrics, traces, alerts)
//    - Capacity & Scaling
//    - Cost Model
//    - Disaster Recovery (RTO/RPO, runbook)
//    - Migration & Rollback
//    - Change Management (canary / blue-green / feature flags)
//    - Traceability Matrix (FR → design → test → код)
// 5. Save to output file

// Key Methods:
// - generateSDD(): Promise<string>
// - generateExecutiveSummary(): Promise<string>
// - generateProductRequirements(): Promise<string>
// - generateSystemArchitecture(): Promise<string>
// - generateDetailedDesign(): Promise<string>
// - generateDiagram(kind: 'c4-context'|'c4-container'|'domain'|'er'|'sequence'|'bpmn'|'broker-topology'): Promise<string>
//   // C4-Context рисуется автоматически из integrations[] (каждая INT-* становится внешним узлом)
// - generateADRLog(): Promise<string>
// - generateRisksRegister(): Promise<string>
// - generateTraceabilityMatrix(): Promise<string>  // из stable IDs
// - renderTemplate(template, context): string
```

**Дополнительные команды для полноты SDD:**

```bash
sdd lint                       # completeness linter (см. Generator Capabilities → linter)
sdd spec --update              # diff/update mode: регенерит только изменённые секции
sdd spec --format pdf|html|confluence
sdd migrate                    # миграция requirements.json при росте schemaVersion
sdd import --from jira|linear|md
```

**File: src/commands/spec.command.ts**

```typescript
// 1. Parse CLI options (--output, --format, --validate)
// 2. Create SpecService
// 3. Call execute()
// 4. Display success message + file path
```

**Templates to create:**
```
src/templates/
├── stacks/
│   ├── java/
│   │   ├── init-template.md
│   │   ├── code-examples.hbs
│   │   ├── stack-config.json
│   │   └── prompts/
│   ├── nodejs/
│   ├── python/
│   ├── go/
│   │   ├── init-template.md
│   │   ├── code-examples.hbs
│   │   ├── stack-config.json
│   │   └── prompts/
│   └── rust/
├── architectures/
│   ├── hexagonal/
│   │   ├── structure.md
│   │   └── code-patterns.hbs
│   ├── layered/
│   ├── microservices/
│   ├── event-driven/
│   └── monolith/
└── base/
    └── sdd-base-template.hbs
```

Copy from TEMPLATE_EXAMPLES.md

### Phase 6: Testing (3-4 hours)

**Unit Tests:**
```bash
tests/unit/
├── ConfigManager.test.ts
├── RequirementValidator.test.ts
├── TemplateEngine.test.ts
├── PromptBuilder.test.ts
└── validators.test.ts
```

**Integration Tests:**
```bash
tests/integration/
├── InitService.test.ts
├── BrainstormService.test.ts
├── SpecService.test.ts
└── FileRepository.test.ts
```

**E2E Test:**
```bash
tests/e2e/
└── full-workflow.test.ts
```

Run:
```bash
npm run test                 # All tests
npm run test:unit          # Unit only
npm run test:integration   # Integration only
npm run test:coverage      # Coverage report
```

### Phase 7: CLI Integration (2-3 hours)

**File: src/cli.ts**

```typescript
// 1. Create Commander program
// 2. Register commands:
//    - init
//    - brainstorm
//    - spec
// 3. Add global options:
//    - --verbose (set LOG_LEVEL=debug)
//    - --provider <api|cli>  (override config.claude.provider)
//    - --help
// 4. Error handling
// 5. Exit codes

import { Command } from 'commander';
import { initCommand } from './commands/init.command';
import { brainstormCommand } from './commands/brainstorm.command';
import { specCommand } from './commands/spec.command';

const program = new Command();

program
  .name('sdd-generator')
  .description('Spec-anchored SDD generator with Claude AI')
  .version('1.0.0')
  .option('--provider <api|cli>', 'Claude backend (overrides config)');

program
  .command('init')
  .description('Initialize new SDD project')
  .action(initCommand);

program
  .command('brainstorm')
  .description('Interactive requirement gathering with Claude')
  .action(brainstormCommand);

program
  .command('spec')
  .description('Generate SDD document')
  .option('-o, --output <path>', 'Output file path', './docs/SDD.md')
  .option('-f, --format <format>', 'Output format', 'markdown')
  .option('--validate', 'Validate requirements')
  .action(specCommand);

program.parse();
```

**File: src/index.ts**

```typescript
// Export public APIs for npm package
export * from './types';
export { InitService } from './application/InitService';
export { BrainstormService } from './application/BrainstormService';
export { SpecService } from './application/SpecService';
export { ConfigManager } from './domain/ConfigManager';
export { RequirementValidator } from './domain/RequirementValidator';
```

### Phase 8: Build & Package (1-2 hours)

```bash
# Build
npm run build
# Creates: dist/ with compiled JS + templates

# Test before publishing
npm run test
npm run lint
npm run type-check

# Create .npmignore
# Create README.md
# Create LICENSE

# Publish
npm publish
```

---

## 📁 Final Project Structure

```
sdd-generator/
├── src/
│   ├── commands/
│   │   ├── init.command.ts
│   │   ├── brainstorm.command.ts
│   │   ├── spec.command.ts
│   │   └── types.ts
│   ├── application/
│   │   ├── InitService.ts
│   │   ├── BrainstormService.ts
│   │   ├── SpecService.ts
│   │   └── types.ts
│   ├── domain/
│   │   ├── ConfigManager.ts
│   │   ├── RequirementValidator.ts
│   │   ├── PromptBuilder.ts
│   │   ├── TemplateEngine.ts
│   │   ├── models.ts
│   │   └── types.ts
│   ├── ports/
│   │   ├── IFileRepository.ts
│   │   ├── IClaudeProvider.ts
│   │   └── ILogger.ts
│   ├── adapters/
│   │   ├── FileRepository.ts
│   │   ├── ClaudeAdapter.ts
│   │   └── WinstonLogger.ts
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── helpers.ts
│   │   ├── constants.ts
│   │   └── config.ts
│   ├── templates/
│   │   ├── stacks/
│   │   │   ├── java/...
│   │   │   ├── nodejs/...
│   │   │   └── python/...
│   │   └── architectures/
│   │       ├── hexagonal/...
│   │       └── layered/...
│   ├── types/
│   │   └── index.ts
│   ├── cli.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
├── .prettierrc.json
├── .env.example
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── .gitignore
```

---

## 🧪 Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- ConfigManager.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e
```

---

## 🔧 Development Workflow

```bash
# 1. Start development
npm run dev                    # ts-node src/cli.ts

# 2. Make changes, test
npm run test:watch

# 3. Check types
npm run type-check

# 4. Format code
npm run format

# 5. Lint
npm run lint:fix

# 6. Build
npm run build

# 7. Test the build
npm run start --help
```

---

## 📝 Environment Setup

Create `.env` file:

```bash
# Claude provider selection — cli (default, console subscription) | api
SDD_CLAUDE_PROVIDER=cli

# When provider=cli (Claude Code CLI, для подписчиков Pro/Max/Team)
SDD_CLAUDE_CLI_BIN=claude             # путь к бинарнику; default — из PATH
SDD_CLAUDE_MODEL=claude-opus-4-7      # необязательный override модели

# When provider=api
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Logging
LOG_LEVEL=info

# Optional
SDD_GENERATOR_CACHE=true
SDD_GENERATOR_TEMPLATES_DIR=./templates
```

**Подготовка для `provider=cli`:**

```bash
npm install -g @anthropic-ai/claude-code
claude login                          # OAuth через браузер, привязка подписки
export SDD_CLAUDE_PROVIDER=cli
```

---

## 🎯 Key Implementation Tips

### 1. **File Repository**
- Use `fs/promises` for async operations
- Handle ENOENT errors gracefully
- Support both relative and absolute paths

### 2. **Claude Integration**
- **Provider abstraction**: один порт `IClaudeProvider`, два адаптера — `ClaudeApiAdapter` и `ClaudeCliAdapter`. Factory выбирает по `config.claude.provider` (override через флаг `--provider` или env `SDD_CLAUDE_PROVIDER`).
- **`ClaudeApiAdapter` (`provider=api`)**:
  - API-ключ только через env (`ANTHROPIC_API_KEY`).
  - Retry с экспонентой на 429 (читать `Retry-After`), на 5xx — ограниченный bounded retry.
  - Парсить JSON-ответ, валидировать Zod-схемой перед использованием.
- **`ClaudeCliAdapter` (`provider=cli`)**:
  - Spawn `claude -p "<prompt>" --output-format json` через `child_process.execFile` (без shell, prompt передаётся аргументом — не подвержен инъекциям).
  - Бинарник берётся из `SDD_CLAUDE_CLI_BIN` или из PATH.
  - Парсить stdout как JSON; non-zero exit → typed error.
  - Если бинарник не найден — `ClaudeCliNotInstalledError` с подсказкой `npm i -g @anthropic-ai/claude-code`.
  - Если требуется авторизация — `ClaudeCliAuthError` с подсказкой `claude login`.
  - Таймаут на вызов (default 120s, override через `SDD_CLAUDE_CLI_TIMEOUT_MS`).
  - Лимиты — на стороне подписки (rate-limits Pro/Max), различать transient (429-like) vs permanent (auth/quota).
- Кэш ответов (`SDD_GENERATOR_CACHE`) работает одинаково для обоих провайдеров — ключ = hash(model + prompt + opts).
- Add request logging for debugging (provider, latency, токены/символы; **никогда** не логировать сам prompt в production).

### 3. **Interactive CLI**
- Use `inquirer.js` for user prompts
- Validate user input before processing
- Show progress indicators for long operations
- Clear error messages

### 4. **Templates**
- Use Handlebars for flexibility
- Support conditionals: `{{#if condition}}`
- Register custom helpers
- Cache compiled templates

### 5. **Error Handling**
- Custom error classes
- Proper error messages (actionable)
- Exit codes (0 for success, 1 for errors)
- Stack traces in debug mode

### 6. **Testing**
- Use mocks for external dependencies
- Test both happy path and edge cases
- Use fixtures for test data
- Check file I/O with temp directories

---

## 📖 References

From SDD_GENERATOR_COMPLETE.md:
- Section 2: Product Requirements (FR-1, FR-2, FR-3)
- Section 3: System Architecture (ports & adapters)
- Section 4: Detailed Design (services, models)
- Section 5: Implementation Plan (8 phases)
- Section 6: Testing Strategy (unit, integration, E2E)

From IMPLEMENTATION_EXAMPLES.ts:
- Interface definitions
- Service stubs
- Adapter implementations
- Repository patterns

From TEMPLATE_EXAMPLES.md:
- Java/Spring Boot examples
- Node.js/NestJS examples
- Python/FastAPI examples
- Go examples

From CLAUDE_PROMPTS.md:
- Brainstorm system prompt
- Spec generation prompt
- Example interactions

---

## ✅ Completion Checklist

- [ ] Phase 1: Project setup
- [ ] Phase 2: Domain & adapters
- [ ] Phase 3: Init command
- [ ] Phase 4: Brainstorm command
- [ ] Phase 5: Spec command
- [ ] Phase 6: Comprehensive tests
- [ ] Phase 7: CLI integration
- [ ] Phase 8: Build & publish
- [ ] Documentation complete
- [ ] README with examples
- [ ] npm publish successful

---

## 🚀 Post-Launch

**v1.0.0 (включено в первый релиз):**
- `lint` — completeness checker по чек-листу arc42
- `spec --update` — diff-режим
- `spec --format pdf|html|confluence` — экспорт
- `import --from jira|linear|md` — подтянуть существующие requirements
- `migrate` — миграция `requirements.json` между `schemaVersion`
- Industry templates (fintech / healthcare / e-commerce) с пред-NFR и compliance

**Post-Launch (после v1):**
1. Add `view` command (display requirements)
2. Support for more stacks/architectures
3. Web UI version
4. VS Code extension
5. GitHub Actions integration

---

**Happy coding! 💻**

Remember: Use SDD_GENERATOR_COMPLETE.md as your reference for all details.
Any questions = check the SDD first!
