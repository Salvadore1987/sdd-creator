import * as path from 'path';

import { Command } from 'commander';

import { CachingClaudeProvider } from '../adapters/CachingClaudeProvider';
import { ClaudeProviderFactory } from '../adapters/ClaudeProviderFactory';
import { FileRepository } from '../adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../adapters/HandlebarsTemplateEngine';
import { WinstonLogger } from '../adapters/WinstonLogger';
import {
  BrainstormService,
  type BrainstormResult,
  type BrainstormSkipResult,
} from '../application/BrainstormService';
import { ConfigManager } from '../domain/ConfigManager';
import { IntegrationCatalog } from '../domain/IntegrationCatalog';
import type { ClaudeProviderKind, RequirementTopic, SectionState } from '../domain/models';
import { PromptBuilder } from '../domain/PromptBuilder';
import { PromptLoader } from '../domain/PromptLoader';
import { StatusTracker } from '../domain/StatusTracker';
import { ClaudeApiAuthError } from '../ports/errors';
import type { IClaudeProvider } from '../ports/IClaudeProvider';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';
import type { ITemplateEngine } from '../ports/ITemplateEngine';
import { applyEnvDefaults, pickEnv } from '../utils/config';
import { DEFAULTS } from '../utils/constants';

const TOPICS: readonly RequirementTopic[] = [
  'stakeholders',
  'context',
  'constraints',
  'glossary',
  'features',
  'domain',
  'quality',
  'dependencies',
  'anti',
  'compliance',
];

export interface BrainstormCommandOptions {
  readonly cwd?: string;
  readonly description?: string;
  readonly inputPath?: string;
  readonly skip?: boolean;
  readonly providerOverride?: ClaudeProviderKind;
  readonly templatesRoot?: string;
}

export interface BrainstormCommandDeps {
  readonly files?: IFileRepository;
  readonly templateEngine?: ITemplateEngine;
  readonly logger?: ILogger;
  readonly claude?: IClaudeProvider;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly prompt?: () => Promise<string>;
}

function defaultTemplatesRoot(): string {
  return path.resolve(__dirname, '..', 'templates');
}

export async function runBrainstorm(
  topic: RequirementTopic,
  options: BrainstormCommandOptions = {},
  deps: BrainstormCommandDeps = {},
): Promise<BrainstormResult | BrainstormSkipResult> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const templateEngine = deps.templateEngine ?? new HandlebarsTemplateEngine();
  const logger = deps.logger ?? new WinstonLogger({ level: 'info' });
  const templatesRoot = options.templatesRoot ?? defaultTemplatesRoot();
  const configManager = new ConfigManager(files, { cwd });

  if (options.skip === true) {
    const skipCatalog = await loadCatalog(files, cwd);
    const service = buildService({
      cwd,
      files,
      templateEngine,
      logger,
      configManager,
      templatesRoot,
      claude: deps.claude ?? noopClaudeProvider(),
      ...(skipCatalog !== undefined ? { integrationCatalog: skipCatalog } : {}),
    });
    const result = await service.skip(topic);
    printSkipSummary(result);
    return result;
  }

  const userDescription = await resolveDescription(options, deps, files);
  const claude = deps.claude ?? (await buildClaudeProvider(options, configManager, deps.env, files, cwd, logger));
  const runCatalog = await loadCatalog(files, cwd);

  const service = buildService({
    cwd,
    files,
    templateEngine,
    logger,
    configManager,
    templatesRoot,
    claude,
    ...(runCatalog !== undefined ? { integrationCatalog: runCatalog } : {}),
  });

  const result = await service.run(topic, { userDescription });
  printRunSummary(result);
  return result;
}

interface ServiceWiring {
  readonly cwd: string;
  readonly files: IFileRepository;
  readonly templateEngine: ITemplateEngine;
  readonly logger: ILogger;
  readonly configManager: ConfigManager;
  readonly templatesRoot: string;
  readonly claude: IClaudeProvider;
  readonly integrationCatalog?: IntegrationCatalog;
}

function buildService(wiring: ServiceWiring): BrainstormService {
  const promptLoader = new PromptLoader(wiring.files, wiring.templatesRoot);
  const promptBuilder = new PromptBuilder(wiring.templateEngine);
  return new BrainstormService(
    {
      files: wiring.files,
      claude: wiring.claude,
      configManager: wiring.configManager,
      statusTracker: new StatusTracker(),
      promptBuilder,
      promptLoader,
      logger: wiring.logger,
      ...(wiring.integrationCatalog ? { integrationCatalog: wiring.integrationCatalog } : {}),
    },
    { cwd: wiring.cwd },
  );
}

async function loadCatalog(
  files: IFileRepository,
  cwd: string,
): Promise<IntegrationCatalog | undefined> {
  const filePath = path.join(cwd, DEFAULTS.integrationsFile);
  if (!(await files.exists(filePath))) {
    return undefined;
  }
  const raw = await files.readJson<unknown>(filePath);
  const catalog = new IntegrationCatalog();
  catalog.load(raw);
  return catalog;
}

async function buildClaudeProvider(
  options: BrainstormCommandOptions,
  configManager: ConfigManager,
  envOverride: BrainstormCommandDeps['env'],
  files: IFileRepository,
  cwd: string,
  logger: ILogger,
): Promise<IClaudeProvider> {
  const config = await configManager.load();
  const factory = new ClaudeProviderFactory(logger);
  const env = applyEnvDefaults(envOverride ?? process.env, {});
  const picked = pickEnv(env);
  const kind = factory.resolveKind({
    ...(options.providerOverride !== undefined ? { flag: options.providerOverride } : {}),
    ...(picked.claudeProvider !== undefined ? { env: picked.claudeProvider } : {}),
    configValue: config.claude.provider,
  });
  if (kind === 'api' && (picked.anthropicApiKey === undefined || picked.anthropicApiKey === '')) {
    throw new ClaudeApiAuthError();
  }
  const provider = factory.create(kind, {
    ...(picked.anthropicApiKey !== undefined ? { anthropicApiKey: picked.anthropicApiKey } : {}),
    ...(picked.anthropicBaseUrl !== undefined ? { anthropicBaseUrl: picked.anthropicBaseUrl } : {}),
    ...(picked.claudeCliBin !== undefined ? { cliBin: picked.claudeCliBin } : {}),
    ...(picked.claudeCliTimeoutMs !== undefined
      ? { cliTimeoutMs: Number.parseInt(picked.claudeCliTimeoutMs, 10) }
      : {}),
    ...(picked.claudeModel !== undefined ? { model: picked.claudeModel } : {}),
  });
  const cacheDir = picked.cacheDir ?? path.join(cwd, DEFAULTS.cacheDir);
  return new CachingClaudeProvider(provider, files, logger, { cacheDir });
}

async function resolveDescription(
  options: BrainstormCommandOptions,
  deps: BrainstormCommandDeps,
  files: IFileRepository,
): Promise<string> {
  if (options.description !== undefined && options.description.trim() !== '') {
    return options.description;
  }
  if (options.inputPath !== undefined) {
    const absolute = path.isAbsolute(options.inputPath)
      ? options.inputPath
      : path.resolve(options.cwd ?? process.cwd(), options.inputPath);
    return await files.read(absolute);
  }
  if (deps.prompt !== undefined) {
    return deps.prompt();
  }
  return interactivePrompt();
}

async function interactivePrompt(): Promise<string> {
  const inquirerModule = (await import('inquirer')) as unknown as {
    default: { prompt: (questions: unknown) => Promise<Record<string, unknown>> };
  };
  const inquirer = inquirerModule.default;
  const answers = (await inquirer.prompt([
    {
      type: 'editor',
      name: 'description',
      message: 'Describe what should be captured for this topic (your editor will open):',
    },
  ])) as { description?: string };
  return (answers.description ?? '').trim();
}

function printRunSummary(result: BrainstormResult): void {
  console.log('');
  console.log(`✔ brainstorm ${result.topic} — ${describeState(result.state)}`);
  console.log(`  inputsHash: ${String(result.state.inputsHash ?? '')}`);
}

function printSkipSummary(result: BrainstormSkipResult): void {
  console.log('');
  console.log(`⏭ brainstorm ${result.topic} — skipped at ${String(result.state.skippedAt ?? '')}`);
}

function describeState(state: SectionState): string {
  return `${state.status}${state.updatedAt !== undefined ? ` @ ${state.updatedAt}` : ''}`;
}

export function buildBrainstormCommand(): Command {
  const cmd = new Command('brainstorm');
  cmd.description('Capture requirements for one of the SDD topics');

  for (const topic of TOPICS) {
    cmd
      .command(topic)
      .description(`Brainstorm the "${topic}" section`)
      .option('-d, --description <text>', 'Inline user description')
      .option('-i, --input <file>', 'Read user description from a file')
      .option('--skip', 'Mark this topic as skipped')
      .action(
        async (opts: {
          description?: string;
          input?: string;
          skip?: boolean;
          provider?: ClaudeProviderKind;
        }) => {
          await runBrainstorm(topic, {
            ...(opts.description !== undefined ? { description: opts.description } : {}),
            ...(opts.input !== undefined ? { inputPath: opts.input } : {}),
            ...(opts.skip !== undefined ? { skip: opts.skip } : {}),
            ...(opts.provider !== undefined ? { providerOverride: opts.provider } : {}),
          });
        },
      );
  }
  return cmd;
}

function noopClaudeProvider(): IClaudeProvider {
  return {
    kind: 'cli',
    complete(): Promise<string> {
      return Promise.reject(new Error('Claude provider was not configured for this operation'));
    },
    completeJson<T>(): Promise<T> {
      return Promise.reject<T>(new Error('Claude provider was not configured for this operation'));
    },
  };
}

export { TOPICS as BRAINSTORM_TOPICS };
