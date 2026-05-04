import type { DomainAggregate, Integration, ProjectConfig, Requirement } from './models';

const SAFE = (value: string): string =>
  value.replace(/[`"]/g, '\\$&').replace(/\n/g, ' ').trim();

const TOKEN = (value: string): string =>
  value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');

export class MermaidDiagramBuilder {
  public c4Context(config: ProjectConfig, integrations: readonly Integration[]): string {
    const systemId = TOKEN(config.metadata.name) || 'system';
    const lines: string[] = [
      'C4Context',
      `  title System Context — ${SAFE(config.metadata.name)}`,
      `  Person(user, "User", "Primary actor of the system")`,
      `  System(${systemId}, "${SAFE(config.metadata.name)}", "${SAFE(config.metadata.description ?? config.architecture + ' system')}")`,
      `  Rel(user, ${systemId}, "uses")`,
    ];
    for (const integration of integrations) {
      const id = TOKEN(integration.id);
      const label = SAFE(`${integration.name} (${integration.category})`);
      lines.push(`  System_Ext(${id}, "${label}", "${SAFE(integration.purpose)}")`);
      lines.push(`  Rel(${systemId}, ${id}, "${SAFE(integration.category)}")`);
    }
    return lines.join('\n');
  }

  public domainClass(aggregates: readonly DomainAggregate[]): string {
    if (aggregates.length === 0) {
      return 'classDiagram\n  class EmptyDomain';
    }
    const lines: string[] = ['classDiagram'];
    for (const aggregate of aggregates) {
      const name = TOKEN(aggregate.name);
      lines.push(`  class ${name} {`);
      for (const entity of aggregate.entities) {
        lines.push(`    +${SAFE(entity)}`);
      }
      for (const vo of aggregate.valueObjects) {
        lines.push(`    -${SAFE(vo)}`);
      }
      lines.push('  }');
      for (const event of aggregate.events) {
        const ev = TOKEN(event);
        lines.push(`  class ${ev}`);
        lines.push(`  ${name} ..> ${ev} : emits`);
      }
    }
    return lines.join('\n');
  }

  public erFromAggregates(aggregates: readonly DomainAggregate[]): string {
    if (aggregates.length === 0) {
      return 'erDiagram\n  PLACEHOLDER {}';
    }
    const lines: string[] = ['erDiagram'];
    for (const aggregate of aggregates) {
      for (const entity of aggregate.entities) {
        const name = TOKEN(entity).toUpperCase();
        lines.push(`  ${name} {`);
        lines.push(`    string id PK`);
        lines.push(`    string ${TOKEN(aggregate.name).toLowerCase()}_ref`);
        lines.push('  }');
      }
    }
    return lines.join('\n');
  }

  public brokerTopology(messageBrokers: readonly Integration[]): string {
    if (messageBrokers.length === 0) {
      return 'flowchart LR\n  A[no message brokers]';
    }
    const lines: string[] = ['flowchart LR'];
    for (const broker of messageBrokers) {
      const id = TOKEN(broker.id);
      lines.push(`  subgraph ${id}["${SAFE(broker.name)}"]`);
      const topics = (broker.extra as { topics?: readonly string[] } | undefined)?.topics ?? [];
      if (topics.length === 0) {
        lines.push(`    ${id}_default[default]`);
      } else {
        for (const topic of topics) {
          lines.push(`    ${id}_${TOKEN(topic)}[${SAFE(topic)}]`);
        }
      }
      lines.push('  end');
    }
    return lines.join('\n');
  }

  public defaultSequence(feature: Requirement, integrations: readonly Integration[]): string {
    const lines: string[] = ['sequenceDiagram'];
    lines.push('  participant User');
    lines.push('  participant Service');
    const refs = feature.usesIntegrations ?? [];
    const refMap = new Map(integrations.map((i) => [i.id, i] as const));
    for (const ref of refs) {
      const integration = refMap.get(ref);
      if (integration === undefined) continue;
      lines.push(`  participant ${TOKEN(integration.id)} as ${SAFE(integration.name)}`);
    }
    lines.push(`  User->>Service: ${SAFE(feature.title)}`);
    for (const ref of refs) {
      const integration = refMap.get(ref);
      if (integration === undefined) continue;
      lines.push(`  Service->>${TOKEN(integration.id)}: invoke (${SAFE(integration.category)})`);
      lines.push(`  ${TOKEN(integration.id)}-->>Service: response`);
    }
    lines.push('  Service-->>User: result');
    return lines.join('\n');
  }
}
