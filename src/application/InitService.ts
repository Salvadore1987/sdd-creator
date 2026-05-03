import * as path from 'path';

import type { ConfigManager } from '../domain/ConfigManager';
import {
  SCHEMA_VERSION,
  type Architecture,
  type ClaudeProviderKind,
  type IntegrationsDocument,
  type Language,
  type ProjectConfig,
  type RequirementsDocument,
  type SectionState,
  type Stack,
} from '../domain/models';
import type { IClaudeCliProbe, ClaudeCliProbeResult } from '../ports/IClaudeCliProbe';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';
import type { ITemplateEngine } from '../ports/ITemplateEngine';
import { DEFAULTS } from '../utils/constants';

export type IdempotencyMode = 'overwrite' | 'merge' | 'abort';

export interface InitInput {
  readonly metadata: {
    readonly name: string;
    readonly description?: string;
    readonly owner?: string;
    readonly repository?: string;
  };
  readonly stack: Stack;
  readonly architecture: Architecture;
  readonly language: Language;
  readonly technologies: readonly string[];
  readonly claudeProvider: ClaudeProviderKind;
  readonly claudeModel?: string;
}

export interface InitResult {
  readonly config: ProjectConfig;
  readonly configPath: string;
  readonly requirementsPath: string;
  readonly integrationsPath: string;
  readonly stackTemplatePath: string;
  readonly architectureTemplatePath: string;
  readonly cliProbe?: ClaudeCliProbeResult;
  readonly mode: IdempotencyMode | 'fresh';
}

export interface InitServiceOptions {
  readonly cwd: string;
  readonly templatesRoot: string;
}

export interface InitServiceDeps {
  readonly files: IFileRepository;
  readonly configManager: ConfigManager;
  readonly templateEngine: ITemplateEngine;
  readonly logger: ILogger;
  readonly cliProbe?: IClaudeCliProbe;
}

export class InitAlreadyExistsError extends Error {
  public readonly sddDir: string;

  public constructor(sddDir: string) {
    super(`.sdd directory already exists at ${sddDir}. Pass --force to overwrite or --merge to keep existing data.`);
    this.name = 'InitAlreadyExistsError';
    this.sddDir = sddDir;
    Object.setPrototypeOf(this, InitAlreadyExistsError.prototype);
  }
}

const PENDING_STATE: SectionState = { status: 'pending' };

export class InitService {
  private readonly files: IFileRepository;
  private readonly configManager: ConfigManager;
  private readonly templateEngine: ITemplateEngine;
  private readonly logger: ILogger;
  private readonly cliProbe?: IClaudeCliProbe;
  private readonly cwd: string;
  private readonly templatesRoot: string;

  public constructor(deps: InitServiceDeps, options: InitServiceOptions) {
    this.files = deps.files;
    this.configManager = deps.configManager;
    this.templateEngine = deps.templateEngine;
    this.logger = deps.logger;
    if (deps.cliProbe !== undefined) {
      this.cliProbe = deps.cliProbe;
    }
    this.cwd = options.cwd;
    this.templatesRoot = options.templatesRoot;
  }

  public async execute(
    input: InitInput,
    idempotency: IdempotencyMode = 'abort',
  ): Promise<InitResult> {
    const sddDir = path.join(this.cwd, DEFAULTS.sddDir);
    const sddExists = await this.files.exists(sddDir);

    if (sddExists && idempotency === 'abort') {
      throw new InitAlreadyExistsError(sddDir);
    }
    if (sddExists && idempotency === 'overwrite') {
      this.logger.warn('Overwriting existing .sdd directory', { sddDir });
      await this.files.remove(sddDir);
    }

    const requirementsPath = path.join(this.cwd, DEFAULTS.requirementsFile);
    const integrationsPath = path.join(this.cwd, DEFAULTS.integrationsFile);
    const templatesDir = path.join(sddDir, 'templates');
    const stackTemplatePath = path.join(templatesDir, 'stack.md');
    const architectureTemplatePath = path.join(templatesDir, 'architecture.md');

    const baseConfig = this.configManager.buildInitial({
      metadata: this.normalizeMetadata(input.metadata),
      stack: input.stack,
      architecture: input.architecture,
      language: input.language,
      technologies: [...input.technologies],
      claude: this.buildClaudeConfig(input),
    });

    const wantMerge = idempotency === 'merge' && sddExists;

    const writeIfMissing = async (target: string, write: () => Promise<void>): Promise<void> => {
      if (wantMerge && (await this.files.exists(target))) {
        this.logger.info('Skipping existing file (merge mode)', { target });
        return;
      }
      await write();
    };

    await writeIfMissing(this.configManager.path, async () => {
      await this.configManager.save(baseConfig);
    });

    await writeIfMissing(requirementsPath, async () => {
      await this.files.writeJson(requirementsPath, this.emptyRequirements());
    });

    await writeIfMissing(integrationsPath, async () => {
      await this.files.writeJson(integrationsPath, this.emptyIntegrations());
    });

    await this.files.mkdir(templatesDir);
    await writeIfMissing(stackTemplatePath, async () => {
      const rendered = await this.renderTemplate('stacks', input.stack, baseConfig);
      await this.files.write(stackTemplatePath, rendered);
    });
    await writeIfMissing(architectureTemplatePath, async () => {
      const rendered = await this.renderTemplate('architectures', input.architecture, baseConfig);
      await this.files.write(architectureTemplatePath, rendered);
    });

    let probeResult: ClaudeCliProbeResult | undefined;
    if (input.claudeProvider === 'cli' && this.cliProbe !== undefined) {
      probeResult = await this.cliProbe.probe();
      if (!probeResult.installed) {
        this.logger.warn('Claude CLI is not installed', { hint: probeResult.hint });
      } else if (!probeResult.authenticated) {
        this.logger.warn('Claude CLI is not authenticated', { hint: probeResult.hint });
      } else {
        this.logger.info('Claude CLI detected', { version: probeResult.version });
      }
    }

    const result: InitResult = {
      config: baseConfig,
      configPath: this.configManager.path,
      requirementsPath,
      integrationsPath,
      stackTemplatePath,
      architectureTemplatePath,
      mode: sddExists ? idempotency : 'fresh',
      ...(probeResult !== undefined ? { cliProbe: probeResult } : {}),
    };
    return result;
  }

  private buildClaudeConfig(input: InitInput): ProjectConfig['claude'] {
    return {
      provider: input.claudeProvider,
      ...(input.claudeModel !== undefined ? { model: input.claudeModel } : {}),
    };
  }

  private normalizeMetadata(metadata: InitInput['metadata']): ProjectConfig['metadata'] {
    return {
      name: metadata.name,
      ...(metadata.description !== undefined ? { description: metadata.description } : {}),
      ...(metadata.owner !== undefined ? { owner: metadata.owner } : {}),
      ...(metadata.repository !== undefined ? { repository: metadata.repository } : {}),
    };
  }

  private emptyRequirements(): RequirementsDocument {
    return {
      schemaVersion: SCHEMA_VERSION,
      stakeholders: { state: PENDING_STATE, items: [] },
      context: { state: PENDING_STATE },
      constraints: { state: PENDING_STATE, items: [] },
      glossary: { state: PENDING_STATE, terms: [] },
      features: { state: PENDING_STATE, items: [] },
      domain: { state: PENDING_STATE, aggregates: [] },
      quality: { state: PENDING_STATE, nfrs: [] },
      dependencies: { state: PENDING_STATE, integrationRefs: [] },
      anti: { state: PENDING_STATE, items: [] },
      compliance: { state: PENDING_STATE, items: [] },
      adrs: [],
      risks: [],
    };
  }

  private emptyIntegrations(): IntegrationsDocument {
    return {
      schemaVersion: SCHEMA_VERSION,
      integrations: [],
    };
  }

  private async renderTemplate(
    kind: 'stacks' | 'architectures',
    name: string,
    config: ProjectConfig,
  ): Promise<string> {
    const file = path.join(this.templatesRoot, kind, name, 'init-template.md');
    const exists = await this.files.exists(file);
    const fallbackTemplate =
      kind === 'stacks'
        ? `# {{metadata.name}} — {{stack}} stack\n\n_Initial template not found at ${file}._\n`
        : `# {{metadata.name}} — {{architecture}} architecture\n\n_Initial template not found at ${file}._\n`;
    const source = exists ? await this.files.read(file) : fallbackTemplate;
    return this.templateEngine.render(source, {
      ...config,
      stackName: config.stack,
      architectureName: config.architecture,
      generatedAt: config.createdAt,
    });
  }
}
