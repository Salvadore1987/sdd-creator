import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ZodType } from 'zod';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { BrainstormService } from '../../src/application/BrainstormService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import { IntegrationCatalog } from '../../src/domain/IntegrationCatalog';
import { SCHEMA_VERSION, type RequirementTopic } from '../../src/domain/models';
import { PromptBuilder } from '../../src/domain/PromptBuilder';
import { PromptLoader } from '../../src/domain/PromptLoader';
import { StatusTracker } from '../../src/domain/StatusTracker';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
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

class StubClaudeProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;
  public lastPrompt = '';
  public constructor(private readonly response: unknown) {}
  public complete(): Promise<string> {
    return Promise.resolve(JSON.stringify(this.response));
  }
  public async completeJson<T>(prompt: string, schema: ZodType<T>, _opts?: ClaudeCompleteOptions): Promise<T> {
    void _opts;
    this.lastPrompt = prompt;
    return Promise.resolve(schema.parse(this.response));
  }
}

const RESPONSES: { [K in RequirementTopic]: unknown } = {
  stakeholders: {
    items: [
      { name: 'Alice', role: 'Product Owner', responsibilities: ['scope', 'priorities'], influence: 'high' },
      { name: 'Bob', role: 'SRE', responsibilities: ['oncall'] },
    ],
  },
  context: {
    statement: 'Customers cannot self-serve loan applications.',
    goals: ['cut average time-to-decision', 'reduce manual operations'],
    kpis: ['P95 decision time < 60s', 'manual review < 10%'],
  },
  constraints: { items: ['GDPR', 'must run on JVM 21'] },
  glossary: {
    terms: [
      { term: 'Application', definition: 'A loan request submitted by a customer.' },
      { term: 'Adjudicator', definition: 'A human or rule that decides outcomes.' },
    ],
  },
  features: {
    items: [
      {
        title: 'Submit application',
        description: 'Customer submits a loan application with personal data.',
        priority: 'must',
        acceptanceCriteria: [
          { given: 'a logged-in customer', when: 'they submit a valid application', then: 'a confirmation is shown' },
          { given: 'a logged-in customer', when: 'they submit invalid data', then: 'they see field-level errors' },
        ],
      },
    ],
  },
  domain: {
    aggregates: [
      {
        name: 'LoanApplication',
        boundedContext: 'origination',
        description: 'Represents a single loan request lifecycle.',
        entities: ['Applicant', 'Document'],
        valueObjects: ['Money', 'Address'],
        events: ['ApplicationSubmitted', 'ApplicationApproved'],
      },
    ],
  },
  quality: {
    nfrs: [
      {
        category: 'performance',
        statement: 'Endpoint latency must be predictable under load.',
        measurableTarget: 'P95 < 200ms at 1000 RPS',
        verificationMethod: 'k6 load test in staging',
      },
    ],
  },
  dependencies: { integrationRefs: ['INT-001'] },
  anti: { items: ['no support for cryptocurrency disbursements'] },
  compliance: { items: ['encrypt PII at rest with KMS-managed keys'] },
};

interface TestContext {
  cwd: string;
  service: BrainstormService;
  claude: StubClaudeProvider;
}

async function setupContext(topic: RequirementTopic): Promise<TestContext> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-bs-'));
  const files = new FileRepository();
  const configManager = new ConfigManager(files, { cwd });
  const config = makeProjectConfig({ stack: 'java', architecture: 'hexagonal', language: 'en' });
  await configManager.save(config);

  const requirementsPath = path.join(cwd, '.sdd', 'requirements.json');
  await files.writeJson(requirementsPath, {
    schemaVersion: SCHEMA_VERSION,
    stakeholders: { state: { status: 'pending' }, items: [] },
    context: { state: { status: 'pending' } },
    constraints: { state: { status: 'pending' }, items: [] },
    glossary: { state: { status: 'pending' }, terms: [] },
    features: { state: { status: 'pending' }, items: [] },
    domain: { state: { status: 'pending' }, aggregates: [] },
    quality: { state: { status: 'pending' }, nfrs: [] },
    dependencies: { state: { status: 'pending' }, integrationRefs: [] },
    anti: { state: { status: 'pending' }, items: [] },
    compliance: { state: { status: 'pending' }, items: [] },
    adrs: [],
    risks: [],
  });

  const integrationsPath = path.join(cwd, '.sdd', 'integrations.json');
  await files.writeJson(integrationsPath, {
    schemaVersion: SCHEMA_VERSION,
    integrations: [
      {
        id: 'INT-001',
        category: 'message-broker',
        name: 'RabbitMQ',
        purpose: 'event delivery',
        endpoints: [{ name: 'amqp', protocol: 'amqp' }],
      },
    ],
  });

  const integrationCatalog = new IntegrationCatalog();
  integrationCatalog.load(await files.readJson<unknown>(integrationsPath));

  const templateEngine = new HandlebarsTemplateEngine();
  const promptLoader = new PromptLoader(files, TEMPLATES_ROOT);
  const promptBuilder = new PromptBuilder(templateEngine);
  const claude = new StubClaudeProvider(RESPONSES[topic]);

  const service = new BrainstormService(
    {
      files,
      claude,
      configManager,
      statusTracker: new StatusTracker(),
      promptBuilder,
      promptLoader,
      logger: new NoopLogger(),
      integrationCatalog,
    },
    { cwd },
  );

  return { cwd, service, claude };
}

async function teardown(ctx: TestContext): Promise<void> {
  await fs.rm(ctx.cwd, { recursive: true, force: true });
}

describe('BrainstormService — per-topic snapshots', () => {
  for (const topic of Object.keys(RESPONSES) as RequirementTopic[]) {
    it(`merges ${topic} response and persists requirements.json`, async () => {
      // arrange
      const ctx = await setupContext(topic);
      try {
        // act
        const result = await ctx.service.run(topic, { userDescription: `Please draft ${topic}.` });

        // assert
        expect(result.state.status).toBe('completed');
        expect(result.state.inputsHash).toMatch(/^[a-f0-9]{64}$/);
        const persisted = JSON.parse(await fs.readFile(path.join(ctx.cwd, '.sdd', 'requirements.json'), 'utf8'));
        expect(persisted[topic].state.status).toBe('completed');
        // Stable ID assignment for ID-bearing topics
        if (topic === 'features') {
          expect(persisted.features.items[0].id).toBe('FR-001');
          expect(persisted.features.items[0].acceptanceCriteria[0].id).toBe('AC-FR-001-1');
        }
        if (topic === 'stakeholders') {
          expect(persisted.stakeholders.items[0].id).toBe('SH-001');
        }
        if (topic === 'quality') {
          expect(persisted.quality.nfrs[0].id).toBe('NFR-001');
        }
      } finally {
        await teardown(ctx);
      }
    });
  }
});

describe('BrainstormService — staleness propagation', () => {
  it('marks completed dependents stale when a source topic changes', async () => {
    // arrange
    const ctx = await setupContext('features');
    try {
      // pre-populate domain as completed (depends on features)
      const requirementsPath = path.join(ctx.cwd, '.sdd', 'requirements.json');
      const doc = JSON.parse(await fs.readFile(requirementsPath, 'utf8'));
      doc.domain.state = { status: 'completed', updatedAt: '2026-05-01T00:00:00Z', inputsHash: 'h' };
      doc.quality.state = { status: 'completed', updatedAt: '2026-05-01T00:00:00Z', inputsHash: 'h' };
      await fs.writeFile(requirementsPath, JSON.stringify(doc));

      // act — running brainstorm features should mark domain & quality as stale
      await ctx.service.run('features', { userDescription: 'add features' });

      // assert
      const after = JSON.parse(await fs.readFile(requirementsPath, 'utf8'));
      expect(after.domain.state.status).toBe('stale');
      expect(after.quality.state.status).toBe('stale');
    } finally {
      await teardown(ctx);
    }
  });
});

describe('BrainstormService — skip', () => {
  it('marks the topic skipped without calling Claude', async () => {
    // arrange
    const ctx = await setupContext('anti');
    try {
      // act
      const result = await ctx.service.skip('anti');

      // assert
      expect(result.state.status).toBe('skipped');
      expect(result.state.skippedAt).toBeDefined();
      expect(ctx.claude.lastPrompt).toBe(''); // never called
    } finally {
      await teardown(ctx);
    }
  });
});
