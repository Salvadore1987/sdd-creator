import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { z } from 'zod';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { SpecService } from '../../src/application/SpecService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import { SCHEMA_VERSION } from '../../src/domain/models';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
import type { ILogger } from '../../src/ports/ILogger';
import { DEFAULTS } from '../../src/utils/constants';
import { makeProjectConfig } from '../fixtures/builders';

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');

class StubClaudeProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;
  public calls: Array<{ prompt: string; opts?: ClaudeCompleteOptions }> = [];

  public constructor(private readonly responder: (prompt: string) => string) {}

  public async complete(prompt: string, opts?: ClaudeCompleteOptions): Promise<string> {
    this.calls.push({ prompt, ...(opts !== undefined ? { opts } : {}) });
    return Promise.resolve(this.responder(prompt));
  }

  public async completeJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    return Promise.resolve(schema.parse(JSON.parse(this.responder(prompt))));
  }
}

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

function responder(prompt: string): string {
  if (/sequenceDiagram/i.test(prompt)) {
    return 'sequenceDiagram\n  User->>Service: do\n  Service-->>User: ok';
  }
  if (/C4Container/.test(prompt)) {
    return 'C4Container\n  Person(u, "User", "x")\n  Container(api, "API", "spring")\n  Rel(u, api, "uses")';
  }
  if (/C4Component/.test(prompt)) {
    return 'C4Component\n  Component(svc, "Service", "x")';
  }
  if (/Executive Summary|executive summary/i.test(prompt)) {
    return 'A concise executive summary across two short paragraphs about the project.';
  }
  return `Generated content for prompt starting with: ${prompt.slice(0, 32).replace(/\n/g, ' ')}`;
}

interface SetupResult {
  cwd: string;
  service: SpecService;
  claude: StubClaudeProvider;
}

async function setup(opts: { skipQuality?: boolean; skipStakeholders?: boolean } = {}): Promise<SetupResult> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-spec-'));
  const files = new FileRepository();
  const configManager = new ConfigManager(files, { cwd });
  await configManager.save(makeProjectConfig({ stack: 'java', architecture: 'hexagonal', language: 'en' }));

  const requirements = {
    schemaVersion: SCHEMA_VERSION,
    stakeholders: {
      state: { status: opts.skipStakeholders ? 'skipped' : 'completed', updatedAt: '2026-05-04T00:00:00.000Z' },
      items: opts.skipStakeholders
        ? []
        : [
            { id: 'SH-001', name: 'CTO', role: 'sponsor', responsibilities: ['budget'], influence: 'high' },
          ],
    },
    context: {
      state: { status: 'completed', updatedAt: '2026-05-04T00:00:00.000Z' },
      statement: 'We need a loan service.',
      goals: ['Onboard 1k customers'],
      kpis: ['Time-to-decision < 5min'],
    },
    constraints: { state: { status: 'completed' }, items: ['GDPR'] },
    glossary: {
      state: { status: 'completed' },
      terms: [{ term: 'Loan', definition: 'A monetary advance' }],
    },
    features: {
      state: { status: 'completed' },
      items: [
        {
          id: 'FR-001',
          title: 'Submit application',
          description: 'Customer submits a loan application',
          priority: 'must',
          acceptanceCriteria: [
            { id: 'AC-FR-001-1', given: 'a customer', when: 'they submit', then: 'a record is stored' },
          ],
          usesIntegrations: ['INT-002'],
        },
      ],
    },
    domain: {
      state: { status: 'completed' },
      aggregates: [
        {
          name: 'LoanApplication',
          boundedContext: 'Origination',
          description: 'Aggregate root for an application',
          entities: ['Application'],
          valueObjects: ['Amount'],
          events: ['ApplicationSubmitted'],
        },
      ],
    },
    quality: {
      state: { status: opts.skipQuality ? 'skipped' : 'completed' },
      nfrs: opts.skipQuality
        ? []
        : [
            {
              id: 'NFR-001',
              category: 'performance',
              statement: 'API responds quickly',
              measurableTarget: 'p95 < 200ms @ 1000 RPS',
            },
          ],
    },
    dependencies: { state: { status: 'completed' }, integrationRefs: ['INT-001', 'INT-002'] },
    anti: { state: { status: 'completed' }, items: ['No mobile app in v1'] },
    compliance: { state: { status: 'completed' }, items: ['Data must be encrypted at rest'] },
    adrs: [
      {
        id: 'ADR-001',
        title: 'Use hexagonal architecture',
        status: 'accepted',
        context: 'We need testability',
        decision: 'Adopt ports and adapters',
        consequences: 'Adapters must be thin',
        alternatives: ['layered'],
        relatedRequirements: ['FR-001'],
        createdAt: '2026-05-04T00:00:00.000Z',
      },
    ],
    risks: [
      {
        id: 'RISK-001',
        title: 'Bureau outage',
        description: 'Underwriting blocked',
        likelihood: 'medium',
        impact: 'high',
        mitigation: 'Fallback to cached scores',
        owner: 'platform',
      },
    ],
  };
  await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), requirements);

  const integrations = {
    schemaVersion: SCHEMA_VERSION,
    integrations: [
      {
        id: 'INT-001',
        category: 'message-broker',
        name: 'RabbitMQ',
        purpose: 'event bus',
        endpoints: [{ name: 'amqp', protocol: 'amqp', url: 'amqp://r:5672' }],
        extra: { topics: ['loan.submitted'], delivery: 'at-least-once' },
      },
      {
        id: 'INT-002',
        category: 'external-api',
        name: 'Bureau API',
        purpose: 'credit lookup',
        endpoints: [{ name: 'rest', protocol: 'https', url: 'https://bureau.test' }],
      },
    ],
  };
  await files.writeJson(path.join(cwd, DEFAULTS.integrationsFile), integrations);

  const claude = new StubClaudeProvider(responder);
  const service = new SpecService(
    {
      files,
      templateEngine: new HandlebarsTemplateEngine(),
      configManager,
      claude,
      logger: new NoopLogger(),
    },
    { cwd, templatesRoot: TEMPLATES_ROOT, diagramRetries: 0 },
  );
  return { cwd, service, claude };
}

describe('SpecService', () => {
  it('renders a complete SDD with all 14 sections', async () => {
    // arrange
    const { cwd, service } = await setup();

    // act
    const result = await service.generate();

    // assert
    try {
      expect(result.outputPath.endsWith('docs/SDD.md')).toBe(true);

      const titles = result.sections.map((s) => s.title);
      expect(titles).toEqual([
        'Executive Summary',
        'Stakeholders & Personas',
        'Product Requirements',
        'Quality Attributes',
        'Glossary',
        'System Architecture',
        'Detailed Design',
        'Testing Strategy',
        'Deployment & Operations',
        'Implementation Plan',
        'Architecture Decision Records',
        'Risks Register',
        'Compliance & Security',
        'Traceability',
      ]);

      // sanity content
      expect(result.markdown).toContain('# demo — Software Design Document');
      expect(result.markdown).toContain('## 1. Executive Summary');
      expect(result.markdown).toContain('## 3. Product Requirements');
      expect(result.markdown).toContain('### FR-001 — Submit application');
      expect(result.markdown).toContain('## 4. Quality Attributes');
      expect(result.markdown).toContain('NFR-001');
      expect(result.markdown).toContain('## 6. System Architecture');
      expect(result.markdown).toContain('```mermaid');
      expect(result.markdown).toContain('C4Context');
      expect(result.markdown).toContain('## 7. Detailed Design');
      expect(result.markdown).toContain('classDiagram');
      expect(result.markdown).toContain('## 11. Architecture Decision Records');
      expect(result.markdown).toContain('ADR-001');
      expect(result.markdown).toContain('RISK-001');
      expect(result.markdown).toContain('## 14. Traceability Matrix');
      expect(result.markdown).toContain('FR-001');
      expect(result.markdown).toContain('INT-002');

      // file written
      const written = await fs.readFile(result.outputPath, 'utf8');
      expect(written).toBe(result.markdown);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  it('omits skipped sections by default and emits placeholders when requested', async () => {
    // arrange
    const { cwd, service } = await setup({ skipQuality: true, skipStakeholders: true });

    try {
      // act — without placeholders
      const omitted = await service.generate();

      // assert — skipped sections do not appear in markdown
      expect(omitted.markdown).not.toContain('## 4. Quality Attributes');
      expect(omitted.markdown).not.toContain('## 2. Stakeholders');
      expect(omitted.sections.find((s) => s.title === 'Quality Attributes')?.status).toBe('skipped');

      // act — with placeholders
      const withPlaceholder = await service.generate({ placeholders: true });

      // assert — placeholders rendered
      expect(withPlaceholder.markdown).toContain('Section skipped');
      expect(withPlaceholder.sections.find((s) => s.title === 'Quality Attributes')?.status).toBe(
        'placeholder',
      );
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  it('writes to a custom outputPath when provided', async () => {
    // arrange
    const { cwd, service } = await setup();

    try {
      // act
      const customPath = path.join(cwd, 'custom', 'OUT.md');
      const result = await service.generate({ outputPath: customPath });

      // assert
      expect(result.outputPath).toBe(customPath);
      const exists = await fs
        .stat(customPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  it('generateDiagram dispatches by kind without invoking Claude for data-driven kinds', async () => {
    // arrange
    const { cwd, service, claude } = await setup();

    try {
      const ctx = {
        config: makeProjectConfig({ metadata: { name: 'demo' } }),
        requirements: {
          domain: {
            state: { status: 'completed' as const },
            aggregates: [
              {
                name: 'A',
                boundedContext: 'C',
                description: 'd',
                entities: ['E'],
                valueObjects: [],
                events: [],
              },
            ],
          },
        } as never,
        integrations: [],
        options: {},
      };

      // act
      const before = claude.calls.length;
      const c4 = await service.generateDiagram('c4-context', ctx);
      const dom = await service.generateDiagram('domain', ctx);
      const er = await service.generateDiagram('er', ctx);
      const broker = await service.generateDiagram('broker-topology', ctx);

      // assert
      expect(c4.startsWith('C4Context')).toBe(true);
      expect(dom.startsWith('classDiagram')).toBe(true);
      expect(er.startsWith('erDiagram')).toBe(true);
      expect(broker.startsWith('flowchart')).toBe(true);
      expect(claude.calls.length).toBe(before);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
