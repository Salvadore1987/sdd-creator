import * as path from 'path';

import { Command } from 'commander';
import { z } from 'zod';

import { ClaudeCliProbe } from '../adapters/ClaudeCliProbe';
import { FileRepository } from '../adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../adapters/HandlebarsTemplateEngine';
import { WinstonLogger } from '../adapters/WinstonLogger';
import { InitAlreadyExistsError, InitService, type InitInput, type IdempotencyMode, type InitResult } from '../application/InitService';
import { ConfigManager } from '../domain/ConfigManager';
import type { Architecture, ClaudeProviderKind, Language, Stack } from '../domain/models';
import type { IClaudeCliProbe } from '../ports/IClaudeCliProbe';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';
import type { ITemplateEngine } from '../ports/ITemplateEngine';

const STACKS: readonly Stack[] = ['java', 'node', 'python', 'go', 'rust'];
const ARCHITECTURES: readonly Architecture[] = [
  'hexagonal',
  'layered',
  'microservices',
  'event-driven',
  'monolith',
];
const PROVIDERS: readonly ClaudeProviderKind[] = ['cli', 'api'];
const LANGUAGES: readonly Language[] = ['en', 'ru'];

const initInputSchema = z.object({
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    owner: z.string().optional(),
    repository: z.string().optional(),
  }),
  stack: z.enum(['java', 'node', 'python', 'go', 'rust']),
  architecture: z.enum(['hexagonal', 'layered', 'microservices', 'event-driven', 'monolith']),
  language: z.enum(['en', 'ru']),
  technologies: z.array(z.string().min(1)).default([]),
  claudeProvider: z.enum(['cli', 'api']),
  claudeModel: z.string().optional(),
});

export interface InitCommandOptions {
  readonly cwd?: string;
  readonly nonInteractive?: boolean;
  readonly configPath?: string;
  readonly force?: boolean;
  readonly merge?: boolean;
  readonly providerOverride?: ClaudeProviderKind;
}

export interface InitCommandDeps {
  readonly files?: IFileRepository;
  readonly templateEngine?: ITemplateEngine;
  readonly logger?: ILogger;
  readonly cliProbe?: IClaudeCliProbe;
  readonly templatesRoot?: string;
  readonly prompt?: (
    defaults: { providers: readonly ClaudeProviderKind[]; stacks: readonly Stack[]; architectures: readonly Architecture[]; languages: readonly Language[] },
  ) => Promise<InitInput>;
}

function defaultTemplatesRoot(): string {
  return path.resolve(__dirname, '..', 'templates');
}

export async function runInit(
  options: InitCommandOptions = {},
  deps: InitCommandDeps = {},
): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const templateEngine = deps.templateEngine ?? new HandlebarsTemplateEngine();
  const logger = deps.logger ?? new WinstonLogger({ level: 'info' });
  const templatesRoot = deps.templatesRoot ?? defaultTemplatesRoot();
  const configManager = new ConfigManager(files, { cwd });
  const cliProbe = deps.cliProbe ?? new ClaudeCliProbe();

  const input = await resolveInput(options, deps, files);
  const finalInput: InitInput = options.providerOverride
    ? { ...input, claudeProvider: options.providerOverride }
    : input;

  const idempotency: IdempotencyMode = options.force
    ? 'overwrite'
    : options.merge
      ? 'merge'
      : 'abort';

  const service = new InitService(
    { files, configManager, templateEngine, logger, cliProbe },
    { cwd, templatesRoot },
  );

  try {
    const result = await service.execute(finalInput, idempotency);
    printSummary(result);
    return result;
  } catch (error) {
    if (error instanceof InitAlreadyExistsError) {
      console.error(error.message);
      throw error;
    }
    throw error;
  }
}

async function resolveInput(
  options: InitCommandOptions,
  deps: InitCommandDeps,
  files: IFileRepository,
): Promise<InitInput> {
  if (options.nonInteractive === true || options.configPath !== undefined) {
    if (options.configPath === undefined) {
      throw new Error('--non-interactive requires --config <path-to-init.json>');
    }
    const absolute = path.isAbsolute(options.configPath)
      ? options.configPath
      : path.resolve(options.cwd ?? process.cwd(), options.configPath);
    const raw = await files.readJson<unknown>(absolute);
    return initInputSchema.parse(raw);
  }
  if (deps.prompt !== undefined) {
    return deps.prompt({
      providers: PROVIDERS,
      stacks: STACKS,
      architectures: ARCHITECTURES,
      languages: LANGUAGES,
    });
  }
  return interactivePrompt();
}

async function interactivePrompt(): Promise<InitInput> {
  const inquirerModule = (await import('inquirer')) as unknown as {
    default: { prompt: (questions: unknown) => Promise<Record<string, unknown>> };
  };
  const inquirer = inquirerModule.default;
  const answers = (await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Project name', validate: (v: string) => v.trim().length > 0 || 'name is required' },
    { type: 'input', name: 'description', message: 'Project description (optional)' },
    { type: 'input', name: 'owner', message: 'Owner / team (optional)' },
    { type: 'input', name: 'repository', message: 'Repository URL (optional)' },
    { type: 'list', name: 'claudeProvider', message: 'Claude provider', choices: [...PROVIDERS], default: 'cli' },
    { type: 'list', name: 'stack', message: 'Stack', choices: [...STACKS], default: 'java' },
    { type: 'list', name: 'architecture', message: 'Architecture', choices: [...ARCHITECTURES], default: 'hexagonal' },
    { type: 'list', name: 'language', message: 'Doc language', choices: [...LANGUAGES], default: 'en' },
    { type: 'input', name: 'technologies', message: 'Technologies (comma-separated)', default: '' },
    { type: 'input', name: 'claudeModel', message: 'Claude model override (optional)' },
  ])) as {
    name: string;
    description: string;
    owner: string;
    repository: string;
    claudeProvider: ClaudeProviderKind;
    stack: Stack;
    architecture: Architecture;
    language: Language;
    technologies: string;
    claudeModel: string;
  };

  const technologies = answers.technologies
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const input: InitInput = {
    metadata: {
      name: answers.name,
      ...(answers.description.trim() !== '' ? { description: answers.description.trim() } : {}),
      ...(answers.owner.trim() !== '' ? { owner: answers.owner.trim() } : {}),
      ...(answers.repository.trim() !== '' ? { repository: answers.repository.trim() } : {}),
    },
    stack: answers.stack,
    architecture: answers.architecture,
    language: answers.language,
    technologies,
    claudeProvider: answers.claudeProvider,
    ...(answers.claudeModel.trim() !== '' ? { claudeModel: answers.claudeModel.trim() } : {}),
  };
  return input;
}

function printSummary(result: InitResult): void {
  console.log('');
  console.log('SDD project initialised.');
  console.log(`  config:        ${result.configPath}`);
  console.log(`  requirements:  ${result.requirementsPath}`);
  console.log(`  integrations:  ${result.integrationsPath}`);
  console.log(`  stack tmpl:    ${result.stackTemplatePath}`);
  console.log(`  arch  tmpl:    ${result.architectureTemplatePath}`);
  if (result.cliProbe !== undefined) {
    if (!result.cliProbe.installed) {
      console.warn(`  ⚠ Claude CLI not installed. ${result.cliProbe.hint ?? ''}`);
    } else if (!result.cliProbe.authenticated) {
      console.warn(`  ⚠ Claude CLI not authenticated. ${result.cliProbe.hint ?? ''}`);
    } else {
      console.log(`  Claude CLI:    ${result.cliProbe.version ?? 'detected'}`);
    }
  }
  console.log('');
  console.log('Next: `sdd brainstorm features`');
}

export function buildInitCommand(): Command {
  const cmd = new Command('init');
  cmd
    .description('Initialise a new SDD project (creates .sdd/ scaffold)')
    .option('--non-interactive', 'Run without prompts (requires --config)')
    .option('--config <path>', 'Path to a JSON file with init answers')
    .option('--force', 'Overwrite an existing .sdd/ directory')
    .option('--merge', 'Keep existing files in .sdd/ and only write missing ones')
    .action(async (opts: { nonInteractive?: boolean; config?: string; force?: boolean; merge?: boolean; provider?: ClaudeProviderKind }) => {
      await runInit({
        ...(opts.nonInteractive !== undefined ? { nonInteractive: opts.nonInteractive } : {}),
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
        ...(opts.force !== undefined ? { force: opts.force } : {}),
        ...(opts.merge !== undefined ? { merge: opts.merge } : {}),
        ...(opts.provider !== undefined ? { providerOverride: opts.provider } : {}),
      });
    });
  return cmd;
}
