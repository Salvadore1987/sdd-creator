import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { AsyncApiImporter } from '../../src/adapters/importers/AsyncApiImporter';
import { BpmnImporter } from '../../src/adapters/importers/BpmnImporter';
import { OpenApiImporter } from '../../src/adapters/importers/OpenApiImporter';
import { IntegrationsService } from '../../src/application/IntegrationsService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import type { ILogger } from '../../src/ports/ILogger';
import { makeProjectConfig } from '../fixtures/builders';

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

async function setup(): Promise<{ cwd: string; service: IntegrationsService; files: FileRepository }> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-int-'));
  const files = new FileRepository();
  const configManager = new ConfigManager(files, { cwd });
  await configManager.save(makeProjectConfig({ stack: 'java', architecture: 'hexagonal', language: 'en' }));
  const importers = [new OpenApiImporter(files), new AsyncApiImporter(files), new BpmnImporter(files)];
  const service = new IntegrationsService(
    {
      files,
      templateEngine: new HandlebarsTemplateEngine(),
      configManager,
      logger: new NoopLogger(),
    },
    { cwd, templatesRoot: TEMPLATES_ROOT, importers },
  );
  return { cwd, service, files };
}

describe('Integrations flow (integration)', () => {
  it('add → list → show → import → spec round-trip', async () => {
    // arrange
    const { cwd, service } = await setup();
    try {
      // act — add first integration manually
      const camunda = await service.add({
        category: 'bpms',
        name: 'Camunda 8',
        purpose: 'Loan origination workflow',
        endpoints: [{ name: 'gateway', protocol: 'grpc', url: 'zeebe://camunda:26500' }],
        auth: { mode: 'oauth2', secretsRef: 'vault://camunda/sa' },
        extra: { engine: 'camunda-8', processes: ['loanOrigination'] },
      });
      const rabbit = await service.add({
        category: 'message-broker',
        name: 'RabbitMQ',
        purpose: 'event delivery',
        endpoints: [{ name: 'amqp', protocol: 'amqp', url: 'amqp://rabbit:5672' }],
        extra: { flavor: 'rabbitmq', topics: ['orders.placed'], delivery: 'at-least-once' },
      });

      // assert IDs and persistence
      expect(camunda.id).toBe('INT-001');
      expect(rabbit.id).toBe('INT-002');
      const list = await service.list();
      expect(list).toHaveLength(2);
      const shown = await service.show('INT-002');
      expect(shown.name).toBe('RabbitMQ');

      // act — import an OpenAPI spec
      const openapiPath = path.join(cwd, 'spec.json');
      await fs.writeFile(
        openapiPath,
        JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'Bureau API', version: '1.0.0' },
          servers: [{ url: 'https://bureau.test' }],
          paths: { '/score': { get: { summary: 'Get score' } } },
        }),
      );
      const imported = await service.import('openapi', openapiPath);

      // assert import + sequencing
      expect(imported).toHaveLength(1);
      expect(imported[0]?.id).toBe('INT-003');
      const finalList = await service.list();
      expect(finalList).toHaveLength(3);

      // act — render INTEGRATIONS.md
      const result = await service.generateSpec();

      // assert
      expect(result.outputPath.endsWith('INTEGRATIONS.md')).toBe(true);
      expect(result.markdown).toContain('# Integrations Catalog');
      expect(result.markdown).toContain('INT-001');
      expect(result.markdown).toContain('Camunda 8');
      expect(result.markdown).toContain('RabbitMQ');
      expect(result.markdown).toContain('Bureau API');
      expect(result.markdown).toContain('mermaid'); // bpms + message-broker have diagrams
      expect(result.markdown).toContain('## Cross-cutting concerns');
      expect(result.markdown).toContain('## Traceability');
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  it('validate flags missing secretsRef as warning', async () => {
    // arrange
    const { cwd, service } = await setup();
    try {
      await service.add({
        category: 'cache',
        name: 'Redis',
        purpose: 'cache',
        endpoints: [{ name: 'redis', protocol: 'redis', url: 'redis://r:6379' }],
        // no auth.secretsRef
      });

      // act
      const report = await service.validate();

      // assert
      expect(report.errorCount).toBe(0);
      expect(report.warningCount).toBeGreaterThanOrEqual(1);
      expect(report.findings.some((f) => f.message.includes('secretsRef'))).toBe(true);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
