# Architecture Decision Records

This directory holds ADRs for the load-bearing architecture choices in `sdd-generator`.
Format: a tweaked Michael Nygard template — *Status*, *Context*, *Decision*, *Consequences*, *Alternatives considered*.

| ID | Title | Status |
|---|---|---|
| [ADR-001](./ADR-001-hexagonal-architecture.md) | Hexagonal architecture (ports and adapters) | Accepted |
| [ADR-002](./ADR-002-handlebars-templates.md) | Handlebars for template rendering | Accepted |
| [ADR-003](./ADR-003-commander-cli.md) | Commander.js for the CLI surface | Accepted |
| [ADR-004](./ADR-004-zod-validation.md) | Zod for runtime schema validation | Accepted |
| [ADR-005](./ADR-005-provider-abstraction.md) | Two Claude provider backends behind a single port | Accepted |

When proposing a new architectural decision, copy `ADR-001-hexagonal-architecture.md` as a template and bump the next sequential number.
