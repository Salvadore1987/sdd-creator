import * as path from 'path';

import { Command } from 'commander';

import { FileRepository } from '../adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../adapters/HandlebarsTemplateEngine';
import { AsyncApiImporter } from '../adapters/importers/AsyncApiImporter';
import { BpmnImporter } from '../adapters/importers/BpmnImporter';
import { OpenApiImporter } from '../adapters/importers/OpenApiImporter';
import { WinstonLogger } from '../adapters/WinstonLogger';
import { IntegrationsService } from '../application/IntegrationsService';
import { ConfigManager } from '../domain/ConfigManager';
import type { Integration, IntegrationCategory } from '../domain/models';
import type { IFileRepository } from '../ports/IFileRepository';
import type { IIntegrationImporter, ImportFormat } from '../ports/IIntegrationImporter';
import type { ILogger } from '../ports/ILogger';
import type { ITemplateEngine } from '../ports/ITemplateEngine';

const FORMATS: readonly ImportFormat[] = ['openapi', 'asyncapi', 'bpmn'];

export interface IntegrationsCommandDeps {
  readonly files?: IFileRepository;
  readonly templateEngine?: ITemplateEngine;
  readonly logger?: ILogger;
  readonly templatesRoot?: string;
  readonly importers?: readonly IIntegrationImporter[];
}

interface CommonOptions {
  readonly cwd?: string;
}

function defaultTemplatesRoot(): string {
  return path.resolve(__dirname, '..', 'templates');
}

function buildService(
  options: CommonOptions,
  deps: IntegrationsCommandDeps,
): IntegrationsService {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const templateEngine = deps.templateEngine ?? new HandlebarsTemplateEngine();
  const logger = deps.logger ?? new WinstonLogger({ level: 'info' });
  const templatesRoot = deps.templatesRoot ?? defaultTemplatesRoot();
  const configManager = new ConfigManager(files, { cwd });
  const importers =
    deps.importers ?? [new OpenApiImporter(files), new AsyncApiImporter(files), new BpmnImporter(files)];
  return new IntegrationsService(
    { files, templateEngine, configManager, logger },
    { cwd, templatesRoot, importers },
  );
}

export async function listIntegrations(
  options: CommonOptions = {},
  deps: IntegrationsCommandDeps = {},
): Promise<readonly Integration[]> {
  const service = buildService(options, deps);
  const items = await service.list();
  if (items.length === 0) {
    console.log('(no integrations registered)');
  } else {
    for (const integration of items) {
      console.log(`${integration.id}  ${integration.category.padEnd(16)} ${integration.name}`);
    }
  }
  return items;
}

export async function showIntegration(
  id: string,
  options: CommonOptions = {},
  deps: IntegrationsCommandDeps = {},
): Promise<Integration> {
  const service = buildService(options, deps);
  const integration = await service.show(id);
  console.log(JSON.stringify(integration, null, 2));
  return integration;
}

export interface AddIntegrationOptions extends CommonOptions {
  readonly inputPath?: string;
  readonly category?: IntegrationCategory;
}

export async function addIntegration(
  options: AddIntegrationOptions = {},
  deps: IntegrationsCommandDeps = {},
): Promise<Integration> {
  const service = buildService(options, deps);
  const files = deps.files ?? new FileRepository();
  const cwd = options.cwd ?? process.cwd();
  if (options.inputPath === undefined) {
    throw new Error('integrations add currently requires --input <path-to-integration.json>');
  }
  const absolute = path.isAbsolute(options.inputPath)
    ? options.inputPath
    : path.resolve(cwd, options.inputPath);
  const draft = await files.readJson<Omit<Integration, 'id'>>(absolute);
  if (options.category !== undefined && draft.category !== options.category) {
    throw new Error(
      `--category=${options.category} does not match payload category "${draft.category}"`,
    );
  }
  const created = await service.add(draft);
  console.log(`Added ${created.id} (${created.category}) — ${created.name}`);
  return created;
}

export interface EditIntegrationOptions extends CommonOptions {
  readonly inputPath: string;
}

export async function editIntegration(
  id: string,
  options: EditIntegrationOptions,
  deps: IntegrationsCommandDeps = {},
): Promise<Integration> {
  const service = buildService(options, deps);
  const files = deps.files ?? new FileRepository();
  const cwd = options.cwd ?? process.cwd();
  const absolute = path.isAbsolute(options.inputPath)
    ? options.inputPath
    : path.resolve(cwd, options.inputPath);
  const patch = await files.readJson<Partial<Omit<Integration, 'id'>>>(absolute);
  const updated = await service.edit(id, patch);
  console.log(`Updated ${updated.id}`);
  return updated;
}

export async function removeIntegration(
  id: string,
  options: CommonOptions = {},
  deps: IntegrationsCommandDeps = {},
): Promise<void> {
  const service = buildService(options, deps);
  await service.remove(id);
  console.log(`Removed ${id}`);
}

export async function validateIntegrations(
  options: CommonOptions = {},
  deps: IntegrationsCommandDeps = {},
): Promise<{ errorCount: number; warningCount: number }> {
  const service = buildService(options, deps);
  const report = await service.validate();
  for (const finding of report.findings) {
    const tag = finding.severity === 'error' ? '✖' : '⚠';
    console.log(`${tag} ${finding.id}: ${finding.message}`);
  }
  console.log(`${report.errorCount} error(s), ${report.warningCount} warning(s)`);
  return { errorCount: report.errorCount, warningCount: report.warningCount };
}

export interface ImportIntegrationsOptions extends CommonOptions {
  readonly format: ImportFormat;
  readonly filePath: string;
}

export async function importIntegrations(
  options: ImportIntegrationsOptions,
  deps: IntegrationsCommandDeps = {},
): Promise<readonly Integration[]> {
  const service = buildService(options, deps);
  const created = await service.import(options.format, options.filePath);
  for (const c of created) {
    console.log(`Imported ${c.id} (${c.category}) — ${c.name}`);
  }
  return created;
}

export interface SpecIntegrationsOptions extends CommonOptions {
  readonly outputPath?: string;
}

export async function generateIntegrationsSpec(
  options: SpecIntegrationsOptions = {},
  deps: IntegrationsCommandDeps = {},
): Promise<{ outputPath: string }> {
  const service = buildService(options, deps);
  const result = await service.generateSpec(options.outputPath);
  console.log(`Wrote ${result.outputPath}`);
  return { outputPath: result.outputPath };
}

export function buildIntegrationsCommand(): Command {
  const cmd = new Command('integrations').description('Manage the project integrations catalog');

  cmd
    .command('list')
    .description('List registered integrations')
    .action(async () => {
      await listIntegrations();
    });

  cmd
    .command('show <id>')
    .description('Show one integration as JSON')
    .action(async (id: string) => {
      await showIntegration(id);
    });

  cmd
    .command('add')
    .description('Add an integration from a JSON payload')
    .option('-i, --input <file>', 'Path to JSON payload (required)')
    .option('-c, --category <category>', 'Optional category guard')
    .action(
      async (opts: { input?: string; category?: IntegrationCategory }) => {
        await addIntegration({
          ...(opts.input !== undefined ? { inputPath: opts.input } : {}),
          ...(opts.category !== undefined ? { category: opts.category } : {}),
        });
      },
    );

  cmd
    .command('edit <id>')
    .description('Edit an integration (merge patch from JSON)')
    .requiredOption('-i, --input <file>', 'Path to JSON patch')
    .action(async (id: string, opts: { input: string }) => {
      await editIntegration(id, { inputPath: opts.input });
    });

  cmd
    .command('remove <id>')
    .description('Remove an integration')
    .action(async (id: string) => {
      await removeIntegration(id);
    });

  cmd
    .command('validate')
    .description('Validate integrations.json against per-category schemas')
    .action(async () => {
      const report = await validateIntegrations();
      if (report.errorCount > 0) {
        process.exitCode = 1;
      }
    });

  cmd
    .command('import')
    .description('Import integrations from openapi|asyncapi|bpmn')
    .requiredOption('--from <format>', `One of: ${FORMATS.join(', ')}`)
    .requiredOption('-f, --file <path>', 'Path to source spec file')
    .action(async (opts: { from: string; file: string }) => {
      const format = opts.from as ImportFormat;
      if (!FORMATS.includes(format)) {
        throw new Error(`Unknown format "${opts.from}". One of: ${FORMATS.join(', ')}`);
      }
      await importIntegrations({ format, filePath: opts.file });
    });

  cmd
    .command('spec')
    .description('Render INTEGRATIONS.md')
    .option('-o, --output <path>', 'Output file path (default: docs/INTEGRATIONS.md)')
    .action(async (opts: { output?: string }) => {
      await generateIntegrationsSpec({
        ...(opts.output !== undefined ? { outputPath: opts.output } : {}),
      });
    });

  return cmd;
}
