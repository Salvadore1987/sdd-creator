import * as path from 'path';

import { getResponseSchema, type BrainstormResponseByTopic } from '../domain/BrainstormSchemas';
import type { ConfigManager } from '../domain/ConfigManager';
import type { IntegrationCatalog } from '../domain/IntegrationCatalog';
import {
  SCHEMA_VERSION,
  type ProjectConfig,
  type RequirementTopic,
  type RequirementsDocument,
  type SectionState,
} from '../domain/models';
import type { PromptBuilder } from '../domain/PromptBuilder';
import type { PromptLoader } from '../domain/PromptLoader';
import { RequirementsMerger } from '../domain/RequirementsMerger';
import type { StatusTracker } from '../domain/StatusTracker';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../ports/IClaudeProvider';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';
import { DEFAULTS } from '../utils/constants';
import { requirementsDocumentSchema } from '../utils/validators';

export interface BrainstormRunInput {
  readonly userDescription: string;
  readonly extra?: Record<string, unknown>;
}

export interface BrainstormResult {
  readonly topic: RequirementTopic;
  readonly response: BrainstormResponseByTopic[RequirementTopic];
  readonly document: RequirementsDocument;
  readonly state: SectionState;
}

export interface BrainstormSkipResult {
  readonly topic: RequirementTopic;
  readonly document: RequirementsDocument;
  readonly state: SectionState;
}

export interface BrainstormServiceDeps {
  readonly files: IFileRepository;
  readonly claude: IClaudeProvider;
  readonly configManager: ConfigManager;
  readonly statusTracker: StatusTracker;
  readonly promptBuilder: PromptBuilder;
  readonly promptLoader: PromptLoader;
  readonly merger?: RequirementsMerger;
  readonly integrationCatalog?: IntegrationCatalog;
  readonly logger: ILogger;
}

export interface BrainstormServiceOptions {
  readonly cwd: string;
  readonly claudeOptions?: ClaudeCompleteOptions;
}

export class BrainstormService {
  private readonly files: IFileRepository;
  private readonly claude: IClaudeProvider;
  private readonly configManager: ConfigManager;
  private readonly statusTracker: StatusTracker;
  private readonly promptBuilder: PromptBuilder;
  private readonly promptLoader: PromptLoader;
  private readonly merger: RequirementsMerger;
  private readonly integrationCatalog?: IntegrationCatalog;
  private readonly logger: ILogger;
  private readonly cwd: string;
  private readonly claudeOptions?: ClaudeCompleteOptions;

  public constructor(deps: BrainstormServiceDeps, options: BrainstormServiceOptions) {
    this.files = deps.files;
    this.claude = deps.claude;
    this.configManager = deps.configManager;
    this.statusTracker = deps.statusTracker;
    this.promptBuilder = deps.promptBuilder;
    this.promptLoader = deps.promptLoader;
    this.merger = deps.merger ?? new RequirementsMerger();
    if (deps.integrationCatalog !== undefined) {
      this.integrationCatalog = deps.integrationCatalog;
    }
    this.logger = deps.logger;
    this.cwd = options.cwd;
    if (options.claudeOptions !== undefined) {
      this.claudeOptions = options.claudeOptions;
    }
  }

  public async run<T extends RequirementTopic>(
    topic: T,
    input: BrainstormRunInput,
  ): Promise<BrainstormResult> {
    const config = await this.configManager.load();
    const document = await this.loadRequirements();

    const promptTemplate = await this.promptLoader.loadBrainstorm(config.stack, topic);
    const knownIntegrationIds = this.integrationCatalog
      ? Array.from(this.integrationCatalog.ids())
      : [];
    const prompt = this.promptBuilder.build(promptTemplate, {
      config,
      requirements: document,
      extra: {
        topic,
        userDescription: input.userDescription,
        knownIntegrationIds: knownIntegrationIds.join(', '),
        ...(input.extra ?? {}),
      },
    });

    this.logger.info('brainstorm: calling Claude', {
      topic,
      stack: config.stack,
      provider: this.claude.kind,
    });
    const schema = getResponseSchema(topic);
    const response = await this.claude.completeJson(prompt, schema, this.claudeOptions);

    const inputsHash = this.statusTracker.hashInputs({
      topic,
      userDescription: input.userDescription,
      response,
    });
    const state = this.statusTracker.markCompleted({ inputsHash });

    const merged = this.merger.merge(document, topic, response, { state });
    const propagated = this.applyStaleness(merged, topic);

    await this.persist(propagated);
    await this.touchConfig(config);

    return {
      topic,
      response,
      document: propagated,
      state,
    };
  }

  public async skip(topic: RequirementTopic): Promise<BrainstormSkipResult> {
    const document = await this.loadRequirements();
    const state = this.statusTracker.markSkipped();
    const next = this.replaceState(document, topic, state);
    const propagated = this.applyStaleness(next, topic);
    await this.persist(propagated);
    return { topic, document: propagated, state };
  }

  private applyStaleness(document: RequirementsDocument, topic: RequirementTopic): RequirementsDocument {
    const sections = this.collectSectionStates(document);
    const next = this.statusTracker.propagateStaleness(sections, topic);
    return this.applySectionStates(document, next);
  }

  private collectSectionStates(
    doc: RequirementsDocument,
  ): Record<RequirementTopic, SectionState> {
    return {
      stakeholders: doc.stakeholders.state,
      context: doc.context.state,
      constraints: doc.constraints.state,
      glossary: doc.glossary.state,
      features: doc.features.state,
      domain: doc.domain.state,
      quality: doc.quality.state,
      dependencies: doc.dependencies.state,
      anti: doc.anti.state,
      compliance: doc.compliance.state,
    };
  }

  private applySectionStates(
    doc: RequirementsDocument,
    sections: Record<RequirementTopic, SectionState>,
  ): RequirementsDocument {
    return {
      ...doc,
      stakeholders: { ...doc.stakeholders, state: sections.stakeholders },
      context: { ...doc.context, state: sections.context },
      constraints: { ...doc.constraints, state: sections.constraints },
      glossary: { ...doc.glossary, state: sections.glossary },
      features: { ...doc.features, state: sections.features },
      domain: { ...doc.domain, state: sections.domain },
      quality: { ...doc.quality, state: sections.quality },
      dependencies: { ...doc.dependencies, state: sections.dependencies },
      anti: { ...doc.anti, state: sections.anti },
      compliance: { ...doc.compliance, state: sections.compliance },
    };
  }

  private replaceState(
    doc: RequirementsDocument,
    topic: RequirementTopic,
    state: SectionState,
  ): RequirementsDocument {
    const sections = this.collectSectionStates(doc);
    sections[topic] = state;
    return this.applySectionStates(doc, sections);
  }

  private async loadRequirements(): Promise<RequirementsDocument> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    const raw = (await this.files.readJson<Record<string, unknown>>(filePath)) ?? {};
    const schemaVersion =
      typeof raw.schemaVersion === 'number' ? raw.schemaVersion : SCHEMA_VERSION;
    return requirementsDocumentSchema.parse({ ...raw, schemaVersion });
  }

  private async persist(document: RequirementsDocument): Promise<void> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    const validated = requirementsDocumentSchema.parse(document);
    await this.files.writeJson(filePath, validated);
  }

  private async touchConfig(config: ProjectConfig): Promise<void> {
    const updated = this.configManager.touch(config);
    await this.configManager.save(updated);
  }
}
