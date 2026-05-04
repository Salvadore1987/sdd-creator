import * as path from 'path';

import type { ConfigManager } from '../domain/ConfigManager';
import { MermaidDiagramBuilder } from '../domain/MermaidDiagramBuilder';
import { MermaidValidator } from '../domain/MermaidValidator';
import type {
  Integration,
  IntegrationsDocument,
  NFR,
  ProjectConfig,
  Requirement,
  RequirementsDocument,
} from '../domain/models';
import { FileNotFoundError } from '../ports/errors';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../ports/IClaudeProvider';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';
import type { ITemplateEngine } from '../ports/ITemplateEngine';
import { DEFAULTS } from '../utils/constants';
import { integrationsDocumentSchema, requirementsDocumentSchema } from '../utils/validators';

export type DiagramKind =
  | 'c4-context'
  | 'c4-container'
  | 'c4-component'
  | 'domain'
  | 'er'
  | 'sequence'
  | 'bpmn'
  | 'broker-topology';

export interface SpecGenerateOptions {
  readonly outputPath?: string;
  readonly placeholders?: boolean;
  readonly update?: boolean;
}

export interface SpecSectionResult {
  readonly key: string;
  readonly title: string;
  readonly status: 'rendered' | 'skipped' | 'placeholder';
  readonly markdown: string;
}

export interface SpecResult {
  readonly outputPath: string;
  readonly markdown: string;
  readonly sections: readonly SpecSectionResult[];
}

export interface SpecServiceDeps {
  readonly files: IFileRepository;
  readonly templateEngine: ITemplateEngine;
  readonly configManager: ConfigManager;
  readonly claude: IClaudeProvider;
  readonly logger: ILogger;
  readonly mermaidValidator?: MermaidValidator;
  readonly diagramBuilder?: MermaidDiagramBuilder;
}

export interface SpecServiceOptions {
  readonly cwd: string;
  readonly templatesRoot: string;
  readonly claudeOptions?: ClaudeCompleteOptions;
  readonly diagramRetries?: number;
}

interface SectionContext {
  readonly config: ProjectConfig;
  readonly requirements: RequirementsDocument;
  readonly integrations: readonly Integration[];
  readonly options: SpecGenerateOptions;
}

export class SpecService {
  private readonly files: IFileRepository;
  private readonly templateEngine: ITemplateEngine;
  private readonly configManager: ConfigManager;
  private readonly claude: IClaudeProvider;
  private readonly logger: ILogger;
  private readonly mermaid: MermaidValidator;
  private readonly diagrams: MermaidDiagramBuilder;
  private readonly cwd: string;
  private readonly templatesRoot: string;
  private readonly claudeOptions?: ClaudeCompleteOptions;
  private readonly diagramRetries: number;

  public constructor(deps: SpecServiceDeps, options: SpecServiceOptions) {
    this.files = deps.files;
    this.templateEngine = deps.templateEngine;
    this.configManager = deps.configManager;
    this.claude = deps.claude;
    this.logger = deps.logger;
    this.mermaid = deps.mermaidValidator ?? new MermaidValidator();
    this.diagrams = deps.diagramBuilder ?? new MermaidDiagramBuilder();
    this.cwd = options.cwd;
    this.templatesRoot = options.templatesRoot;
    if (options.claudeOptions !== undefined) {
      this.claudeOptions = options.claudeOptions;
    }
    this.diagramRetries = options.diagramRetries ?? 2;
  }

  public async generate(options: SpecGenerateOptions = {}): Promise<SpecResult> {
    const config = await this.configManager.load();
    const requirements = await this.loadRequirements();
    const integrations = await this.loadIntegrations();
    const ctx: SectionContext = { config, requirements, integrations, options };

    const generatedAt = new Date().toISOString();
    const header = await this.renderTemplate('header.hbs', { config, generatedAt });

    const sectionFns: ReadonlyArray<() => Promise<SpecSectionResult>> = [
      () => this.generateExecutiveSummary(ctx),
      () => this.generateStakeholders(ctx),
      () => this.generateProductRequirements(ctx),
      () => this.generateQualityAttributes(ctx),
      () => this.generateGlossary(ctx),
      () => this.generateSystemArchitecture(ctx),
      () => this.generateDetailedDesign(ctx),
      () => this.generateTestingStrategy(ctx),
      () => this.generateDeploymentOps(ctx),
      () => this.generateImplementationPlan(ctx),
      () => this.generateAdrLog(ctx),
      () => this.generateRisksRegister(ctx),
      () => this.generateCompliance(ctx),
      () => this.generateTraceability(ctx),
    ];

    const sections: SpecSectionResult[] = [];
    for (const fn of sectionFns) {
      sections.push(await fn());
    }
    const visible = sections.filter(
      (s) => s.status !== 'skipped' || options.placeholders === true,
    );
    const body = visible.map((s) => s.markdown).join('\n\n');
    const markdown = this.mermaid.sanitize(`${header}\n${body}\n`);
    const outputPath = options.outputPath ?? path.join(this.cwd, DEFAULTS.outputSddFile);
    await this.files.write(outputPath, markdown);
    this.logger.info('Wrote SDD', { outputPath, sections: sections.length });
    return { outputPath, markdown, sections };
  }

  public async generateExecutiveSummary(ctx: SectionContext): Promise<SpecSectionResult> {
    if (this.shouldSkip(ctx, 'context', 'stakeholders')) {
      return this.placeholder(ctx, 'executive-summary', 'Executive Summary', 1, 'context');
    }
    const narrative = await this.runPrompt(ctx, 'executive-summary');
    const markdown = await this.renderTemplate('executive-summary.hbs', {
      requirements: ctx.requirements,
      narrative,
    });
    return { key: 'executive-summary', title: 'Executive Summary', status: 'rendered', markdown };
  }

  public async generateProductRequirements(ctx: SectionContext): Promise<SpecSectionResult> {
    if (this.shouldSkip(ctx, 'features')) {
      return this.placeholder(ctx, 'product-requirements', 'Product Requirements', 3, 'features');
    }
    const markdown = await this.renderTemplate('product-requirements.hbs', {
      requirements: ctx.requirements,
    });
    return {
      key: 'product-requirements',
      title: 'Product Requirements',
      status: 'rendered',
      markdown,
    };
  }

  public async generateSystemArchitecture(ctx: SectionContext): Promise<SpecSectionResult> {
    const narrative = await this.runPrompt(ctx, 'system-architecture');
    const c4ContextDiagram = this.diagrams.c4Context(ctx.config, ctx.integrations);
    const c4ContainerDiagram = await this.runDiagramPrompt(ctx, 'c4-container');
    const c4ComponentDiagram = await this.runDiagramPrompt(ctx, 'c4-component');
    const markdown = await this.renderTemplate('system-architecture.hbs', {
      config: ctx.config,
      narrative,
      c4ContextDiagram,
      c4ContainerDiagram,
      c4ComponentDiagram,
    });
    return {
      key: 'system-architecture',
      title: 'System Architecture',
      status: 'rendered',
      markdown,
    };
  }

  public async generateDetailedDesign(ctx: SectionContext): Promise<SpecSectionResult> {
    const dataModelNarrative = await this.runPrompt(ctx, 'data-model', {
      databaseIntegrations: this.byCategory(ctx.integrations, 'database'),
    });
    const apiContractsNarrative = await this.runPrompt(ctx, 'api-contracts', {
      apiIntegrations: this.byCategoryMany(ctx.integrations, ['external-api', 'legacy']),
    });
    const sequenceDiagrams: Array<{ readonly title: string; readonly diagram: string }> = [];
    for (const feature of ctx.requirements.features.items.slice(0, 3)) {
      const generated = await this.runFeatureSequence(ctx, feature);
      sequenceDiagrams.push({ title: `${feature.id} — ${feature.title}`, diagram: generated });
    }
    const domainDiagram = this.diagrams.domainClass(ctx.requirements.domain.aggregates);
    const bpmsIntegrations = this.byCategory(ctx.integrations, 'bpms');
    const bpmnDiagram = bpmsIntegrations.length > 0 ? this.diagrams.bpmnFlow(bpmsIntegrations) : '';
    const markdown = await this.renderTemplate('detailed-design.hbs', {
      requirements: ctx.requirements,
      integrations: ctx.integrations,
      hasOpenApi: ctx.integrations.some((i) => i.category === 'external-api'),
      domainDiagram,
      bpmnDiagram,
      dataModelNarrative,
      apiContractsNarrative,
      sequenceDiagrams,
    });
    return { key: 'detailed-design', title: 'Detailed Design', status: 'rendered', markdown };
  }

  public async generateQualityAttributes(ctx: SectionContext): Promise<SpecSectionResult> {
    if (this.shouldSkip(ctx, 'quality')) {
      return this.placeholder(ctx, 'quality-attributes', 'Quality Attributes', 4, 'quality');
    }
    const narrative = await this.runPrompt(ctx, 'quality-attributes');
    const markdown = await this.renderTemplate('quality-attributes.hbs', {
      requirements: ctx.requirements,
      narrative,
    });
    return {
      key: 'quality-attributes',
      title: 'Quality Attributes',
      status: 'rendered',
      markdown,
    };
  }

  public async generateTestingStrategy(ctx: SectionContext): Promise<SpecSectionResult> {
    const narrative = await this.runPrompt(ctx, 'testing-strategy');
    const markdown = await this.renderTemplate('testing-strategy.hbs', { narrative });
    return { key: 'testing-strategy', title: 'Testing Strategy', status: 'rendered', markdown };
  }

  public async generateDeploymentOps(ctx: SectionContext): Promise<SpecSectionResult> {
    const narrative = await this.runPrompt(ctx, 'deployment-ops');
    const slaNarrative = await this.runPrompt(ctx, 'sla');
    const observabilityIntegrations = this.byCategory(ctx.integrations, 'observability');
    const opsNfrs = ctx.requirements.quality.nfrs.filter(
      (n) => n.category === 'observability' || n.category === 'reliability',
    );
    const observabilityNarrative = await this.runPrompt(ctx, 'observability', {
      observabilityIntegrations,
      opsNfrs,
    });
    const capacityNarrative = await this.runPrompt(ctx, 'capacity');
    const costNarrative = await this.runPrompt(ctx, 'cost');
    const reliabilityNfrs = ctx.requirements.quality.nfrs.filter(
      (n) => n.category === 'reliability',
    );
    const drNarrative = await this.runPrompt(ctx, 'dr', {
      statefulIntegrations: this.byCategoryMany(ctx.integrations, ['database', 'storage']),
      reliabilityNfrs,
    });
    const migrationNarrative = await this.runPrompt(ctx, 'migration', {
      databaseIntegrations: this.byCategory(ctx.integrations, 'database'),
    });
    const changeNarrative = await this.runPrompt(ctx, 'change-management');
    const nfrSlaSubset = ctx.requirements.quality.nfrs.filter((n) =>
      ['performance', 'reliability'].includes(n.category),
    );
    const markdown = await this.renderTemplate('deployment-ops.hbs', {
      narrative,
      slaNarrative,
      observabilityNarrative,
      capacityNarrative,
      costNarrative,
      drNarrative,
      migrationNarrative,
      changeNarrative,
      requirements: ctx.requirements,
      nfrSlaSubset,
    });
    return { key: 'deployment-ops', title: 'Deployment & Operations', status: 'rendered', markdown };
  }

  public async generateImplementationPlan(ctx: SectionContext): Promise<SpecSectionResult> {
    const narrative = await this.runPrompt(ctx, 'implementation-plan');
    const markdown = await this.renderTemplate('implementation-plan.hbs', { narrative });
    return {
      key: 'implementation-plan',
      title: 'Implementation Plan',
      status: 'rendered',
      markdown,
    };
  }

  public async generateDiagram(kind: DiagramKind, ctx: SectionContext): Promise<string> {
    switch (kind) {
      case 'c4-context':
        return this.diagrams.c4Context(ctx.config, ctx.integrations);
      case 'domain':
        return this.diagrams.domainClass(ctx.requirements.domain.aggregates);
      case 'er':
        return this.diagrams.erFromAggregates(ctx.requirements.domain.aggregates);
      case 'broker-topology':
        return this.diagrams.brokerTopology(this.byCategory(ctx.integrations, 'message-broker'));
      case 'bpmn':
        return this.diagrams.bpmnFlow(this.byCategory(ctx.integrations, 'bpms'));
      case 'c4-container':
      case 'c4-component':
      case 'sequence':
        return this.runDiagramPrompt(ctx, this.kindToPromptKey(kind));
    }
  }

  private async generateStakeholders(ctx: SectionContext): Promise<SpecSectionResult> {
    if (this.shouldSkip(ctx, 'stakeholders')) {
      return this.placeholder(ctx, 'stakeholders', 'Stakeholders & Personas', 2, 'stakeholders');
    }
    const markdown = await this.renderTemplate('stakeholders.hbs', {
      requirements: ctx.requirements,
    });
    return {
      key: 'stakeholders',
      title: 'Stakeholders & Personas',
      status: 'rendered',
      markdown,
    };
  }

  private async generateGlossary(ctx: SectionContext): Promise<SpecSectionResult> {
    if (this.shouldSkip(ctx, 'glossary')) {
      return this.placeholder(ctx, 'glossary', 'Glossary', 5, 'glossary');
    }
    const markdown = await this.renderTemplate('glossary.hbs', { requirements: ctx.requirements });
    return { key: 'glossary', title: 'Glossary', status: 'rendered', markdown };
  }

  private async generateAdrLog(ctx: SectionContext): Promise<SpecSectionResult> {
    const markdown = await this.renderTemplate('adr-log.hbs', { requirements: ctx.requirements });
    return { key: 'adr-log', title: 'Architecture Decision Records', status: 'rendered', markdown };
  }

  private async generateRisksRegister(ctx: SectionContext): Promise<SpecSectionResult> {
    const markdown = await this.renderTemplate('risks.hbs', { requirements: ctx.requirements });
    return { key: 'risks', title: 'Risks Register', status: 'rendered', markdown };
  }

  private async generateCompliance(ctx: SectionContext): Promise<SpecSectionResult> {
    if (this.shouldSkip(ctx, 'compliance')) {
      return this.placeholder(ctx, 'compliance', 'Compliance & Security', 13, 'compliance');
    }
    const markdown = await this.renderTemplate('compliance.hbs', {
      requirements: ctx.requirements,
    });
    return {
      key: 'compliance',
      title: 'Compliance & Security',
      status: 'rendered',
      markdown,
    };
  }

  private async generateTraceability(ctx: SectionContext): Promise<SpecSectionResult> {
    const traceability = ctx.requirements.features.items.map((f) => ({
      featureId: f.id,
      title: f.title,
      acIds: f.acceptanceCriteria.map((c) => c.id),
      integrations: f.usesIntegrations ?? [],
    }));
    const markdown = await this.renderTemplate('traceability.hbs', { traceability });
    return { key: 'traceability', title: 'Traceability', status: 'rendered', markdown };
  }

  private async placeholder(
    ctx: SectionContext,
    key: string,
    title: string,
    number: number,
    topic: string,
  ): Promise<SpecSectionResult> {
    if (ctx.options.placeholders !== true) {
      return { key, title, status: 'skipped', markdown: '' };
    }
    const markdown = await this.renderTemplate('placeholder.hbs', { number, title, topic });
    return { key, title, status: 'placeholder', markdown };
  }

  private shouldSkip(
    ctx: SectionContext,
    ...topics: ReadonlyArray<keyof RequirementsDocument>
  ): boolean {
    for (const topic of topics) {
      const section = ctx.requirements[topic];
      if (
        section !== undefined &&
        typeof section === 'object' &&
        'state' in section &&
        section.state.status === 'skipped'
      ) {
        return true;
      }
    }
    return false;
  }

  private async runPrompt(
    ctx: SectionContext,
    promptName: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const promptPath = path.join(this.templatesRoot, 'spec', 'prompts', `${promptName}.prompt`);
    const template = await this.tryReadTemplate(promptPath);
    if (template === undefined) {
      this.logger.warn('Prompt template missing', { promptName });
      return '';
    }
    const prompt = this.templateEngine.render(template, {
      config: ctx.config,
      requirements: ctx.requirements,
      integrations: ctx.integrations,
      ...extra,
    });
    try {
      const text = await this.claude.complete(prompt, this.claudeOptions);
      return text.trim();
    } catch (error) {
      this.logger.warn('Claude prompt failed; emitting placeholder', {
        promptName,
        error: (error as Error).message,
      });
      return '';
    }
  }

  private async runDiagramPrompt(ctx: SectionContext, promptName: string): Promise<string> {
    let last = '';
    for (let attempt = 0; attempt <= this.diagramRetries; attempt += 1) {
      const text = await this.runPrompt(ctx, promptName);
      const stripped = this.stripFences(text);
      const result = this.mermaid.validate(stripped);
      if (result.valid) {
        return stripped;
      }
      this.logger.warn('Generated diagram failed validation', {
        promptName,
        attempt,
        reason: result.reason,
      });
      last = stripped;
    }
    return `%% TODO: human review — invalid mermaid output\n${last}`;
  }

  private async runFeatureSequence(ctx: SectionContext, feature: Requirement): Promise<string> {
    const promptPath = path.join(this.templatesRoot, 'spec', 'prompts', 'sequence.prompt');
    const template = await this.tryReadTemplate(promptPath);
    if (template === undefined) {
      return this.diagrams.defaultSequence(feature, ctx.integrations);
    }
    let last = '';
    for (let attempt = 0; attempt <= this.diagramRetries; attempt += 1) {
      const prompt = this.templateEngine.render(template, { feature, integrations: ctx.integrations });
      let text = '';
      try {
        text = await this.claude.complete(prompt, this.claudeOptions);
      } catch (error) {
        this.logger.warn('Claude sequence prompt failed', { error: (error as Error).message });
        return this.diagrams.defaultSequence(feature, ctx.integrations);
      }
      const stripped = this.stripFences(text);
      if (this.mermaid.validate(stripped).valid) {
        return stripped;
      }
      last = stripped;
      this.logger.warn('Sequence diagram invalid, retrying', { attempt });
    }
    if (last === '') {
      return this.diagrams.defaultSequence(feature, ctx.integrations);
    }
    return `%% TODO: human review — invalid mermaid sequence\n${last}`;
  }

  private byCategory(
    integrations: readonly Integration[],
    category: Integration['category'],
  ): readonly Integration[] {
    return integrations.filter((i) => i.category === category);
  }

  private byCategoryMany(
    integrations: readonly Integration[],
    categories: ReadonlyArray<Integration['category']>,
  ): readonly Integration[] {
    return integrations.filter((i) => categories.includes(i.category));
  }

  private kindToPromptKey(kind: DiagramKind): string {
    switch (kind) {
      case 'c4-container':
        return 'c4-container';
      case 'c4-component':
        return 'c4-component';
      case 'sequence':
        return 'sequence';
      default:
        return kind;
    }
  }

  private stripFences(text: string): string {
    const trimmed = text.trim();
    const fence = /^```(?:mermaid)?\s*\n([\s\S]*?)\n```\s*$/m;
    const match = fence.exec(trimmed);
    if (match !== null && match[1] !== undefined) {
      return match[1].trim();
    }
    return trimmed;
  }

  private async loadRequirements(): Promise<RequirementsDocument> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    if (!(await this.files.exists(filePath))) {
      throw new Error('No requirements found — run `sdd init` and `sdd brainstorm` first.');
    }
    const raw = await this.files.readJson<unknown>(filePath);
    return requirementsDocumentSchema.parse(raw);
  }

  private async loadIntegrations(): Promise<readonly Integration[]> {
    const filePath = path.join(this.cwd, DEFAULTS.integrationsFile);
    if (!(await this.files.exists(filePath))) {
      return [];
    }
    const raw = await this.files.readJson<unknown>(filePath);
    const doc: IntegrationsDocument = integrationsDocumentSchema.parse(raw);
    return doc.integrations;
  }

  private async renderTemplate(
    name: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const template = await this.files.read(
      path.join(this.templatesRoot, 'spec', '_base', name),
    );
    return this.templateEngine.render(template, context);
  }

  private async tryReadTemplate(filePath: string): Promise<string | undefined> {
    try {
      return await this.files.read(filePath);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }
}

export type { NFR };
