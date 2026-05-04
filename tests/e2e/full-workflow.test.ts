import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { z } from 'zod';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { BrainstormService } from '../../src/application/BrainstormService';
import { IntegrationsService } from '../../src/application/IntegrationsService';
import { LintService } from '../../src/application/LintService';
import { SpecService } from '../../src/application/SpecService';
import { runInit } from '../../src/commands/init.command';
import { ConfigManager } from '../../src/domain/ConfigManager';
import { IntegrationCatalog } from '../../src/domain/IntegrationCatalog';
import { PromptBuilder } from '../../src/domain/PromptBuilder';
import { PromptLoader } from '../../src/domain/PromptLoader';
import { StatusTracker } from '../../src/domain/StatusTracker';
import type { IClaudeCliProbe, ClaudeCliProbeResult } from '../../src/ports/IClaudeCliProbe';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
import type { ILogger } from '../../src/ports/ILogger';

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

class StubProbe implements IClaudeCliProbe {
  public probe(): Promise<ClaudeCliProbeResult> {
    return Promise.resolve({ installed: true, authenticated: true, version: 'stub-1.0.0' });
  }
}

class StubClaudeProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;
  public callCount = 0;

  public constructor(private readonly responder: (prompt: string) => unknown) {}

  public complete(prompt: string, _opts?: ClaudeCompleteOptions): Promise<string> {
    void _opts;
    this.callCount += 1;
    const out = this.responder(prompt);
    return Promise.resolve(typeof out === 'string' ? out : JSON.stringify(out));
  }

  public completeJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    this.callCount += 1;
    const out = this.responder(prompt);
    const parsed = typeof out === 'string' ? JSON.parse(out) : out;
    return Promise.resolve(schema.parse(parsed));
  }
}

const FEATURES_RESPONSE = {
  items: [
    {
      title: 'Submit application',
      description: 'Customer submits a new loan application with verification.',
      priority: 'must',
      acceptanceCriteria: [
        {
          given: 'a logged-in customer',
          when: 'they submit a valid application',
          then: 'a confirmation receipt is shown',
        },
      ],
      usesIntegrations: ['INT-001'],
    },
  ],
};

function specResponder(prompt: string): string {
  if (/sequenceDiagram/i.test(prompt)) {
    return 'sequenceDiagram\n  Customer->>Service: submit\n  Service-->>Customer: ok';
  }
  if (/C4Container/.test(prompt)) {
    return 'C4Container\n  Person(u, "Customer", "x")\n  Container(api, "API", "spring")';
  }
  if (/C4Component/.test(prompt)) {
    return 'C4Component\n  Component(svc, "Service", "x")';
  }
  return 'Generated narrative section content covering the requested topic clearly.';
}

describe('full workflow (e2e)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-e2e-full-'));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('init → brainstorm features → integrations add → spec → lint', async () => {
    // arrange
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const initConfigPath = path.join(cwd, 'init.json');
      await fs.writeFile(
        initConfigPath,
        JSON.stringify({
          metadata: { name: 'loan-service', description: 'demo' },
          stack: 'java',
          architecture: 'hexagonal',
          language: 'en',
          technologies: ['Spring Boot 3', 'PostgreSQL 16'],
          claudeProvider: 'cli',
        }),
      );

      // act — INIT
      const initResult = await runInit(
        { cwd, nonInteractive: true, configPath: initConfigPath },
        { cliProbe: new StubProbe() },
      );

      // assert — init scaffold is in place
      expect(initResult.config.metadata.name).toBe('loan-service');
      const sddDir = path.join(cwd, '.sdd');
      const configOnDisk = JSON.parse(
        await fs.readFile(path.join(sddDir, 'config.json'), 'utf8'),
      );
      expect(configOnDisk.stack).toBe('java');
      expect(configOnDisk.claude.provider).toBe('cli');

      // arrange — common deps
      const files = new FileRepository();
      const configManager = new ConfigManager(files, { cwd });
      const templateEngine = new HandlebarsTemplateEngine();
      const logger = new NoopLogger();

      // act — INTEGRATIONS ADD (so brainstorm features can reference INT-001)
      const integrationsService = new IntegrationsService(
        { files, templateEngine, configManager, logger },
        { cwd, templatesRoot: TEMPLATES_ROOT },
      );
      const broker = await integrationsService.add({
        category: 'message-broker',
        name: 'RabbitMQ',
        purpose: 'event delivery',
        endpoints: [{ name: 'amqp', protocol: 'amqp', url: 'amqp://r:5672' }],
        auth: { mode: 'basic', secretsRef: 'vault://rabbit/sa' },
        extra: { flavor: 'rabbitmq', topics: ['loan.submitted'], delivery: 'at-least-once' },
      });
      expect(broker.id).toBe('INT-001');

      // act — BRAINSTORM features
      const integrationCatalog = new IntegrationCatalog();
      integrationCatalog.load(
        await files.readJson<unknown>(path.join(sddDir, 'integrations.json')),
      );
      const brainstormClaude = new StubClaudeProvider(() => FEATURES_RESPONSE);
      const brainstormService = new BrainstormService(
        {
          files,
          claude: brainstormClaude,
          configManager,
          statusTracker: new StatusTracker(),
          promptBuilder: new PromptBuilder(templateEngine),
          promptLoader: new PromptLoader(files, TEMPLATES_ROOT),
          logger,
          integrationCatalog,
        },
        { cwd },
      );
      const featuresResult = await brainstormService.run('features', {
        userDescription: 'A self-serve loan application flow.',
      });
      expect(featuresResult.state.status).toBe('completed');
      expect(brainstormClaude.callCount).toBeGreaterThan(0);

      // act — SPEC
      const specClaude = new StubClaudeProvider(specResponder);
      const specService = new SpecService(
        { files, templateEngine, configManager, claude: specClaude, logger },
        { cwd, templatesRoot: TEMPLATES_ROOT, diagramRetries: 0 },
      );
      const spec = await specService.generate();

      // assert — SDD rendered + integrations referenced
      expect(spec.outputPath.endsWith('docs/SDD.md')).toBe(true);
      expect(spec.markdown).toContain('# loan-service — Software Design Document');
      expect(spec.markdown).toContain('FR-001');
      expect(spec.markdown).toContain('INT-001');
      expect(spec.markdown).toContain('RabbitMQ');

      const onDisk = await fs.readFile(spec.outputPath, 'utf8');
      expect(onDisk).toBe(spec.markdown);

      // act — LINT
      const lintService = new LintService({ files }, { cwd });
      const report = await lintService.run();

      // assert — lint passes (errors == 0); warnings may exist for skipped/unused glossary
      expect(report.errorCount).toBe(0);
      expect(report.findings.find((f) => f.rule === 'mermaid-invalid')).toBeUndefined();
      expect(lintService.exitCodeFor(report)).toBeLessThan(2 + 1); // 0 or 2
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
