import * as path from 'path';

import { Command } from 'commander';

import { CachingClaudeProvider } from '../adapters/CachingClaudeProvider';
import { ClaudeProviderFactory } from '../adapters/ClaudeProviderFactory';
import { ConfluenceExporter } from '../adapters/exporters/ConfluenceExporter';
import { PandocExporter } from '../adapters/exporters/PandocExporter';
import { FileRepository } from '../adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../adapters/HandlebarsTemplateEngine';
import { WinstonLogger } from '../adapters/WinstonLogger';
import { SpecService, type SpecResult } from '../application/SpecService';
import { ConfigManager } from '../domain/ConfigManager';
import type { ClaudeProviderKind } from '../domain/models';
import { ClaudeApiAuthError } from '../ports/errors';
import type { IClaudeProvider } from '../ports/IClaudeProvider';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';
import type { ExportFormat, ISpecExporter } from '../ports/ISpecExporter';
import type { ITemplateEngine } from '../ports/ITemplateEngine';
import { applyEnvDefaults, pickEnv } from '../utils/config';
import { DEFAULTS } from '../utils/constants';

export interface SpecCommandOptions {
  readonly cwd?: string;
  readonly outputPath?: string;
  readonly placeholders?: boolean;
  readonly update?: boolean;
  readonly providerOverride?: ClaudeProviderKind;
  readonly templatesRoot?: string;
  readonly format?: ExportFormat;
  readonly exportPath?: string;
}

export interface SpecCommandDeps {
  readonly files?: IFileRepository;
  readonly templateEngine?: ITemplateEngine;
  readonly logger?: ILogger;
  readonly claude?: IClaudeProvider;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function defaultTemplatesRoot(): string {
  return path.resolve(__dirname, '..', 'templates');
}

export async function runSpec(
  options: SpecCommandOptions = {},
  deps: SpecCommandDeps = {},
): Promise<SpecResult> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const templateEngine = deps.templateEngine ?? new HandlebarsTemplateEngine();
  const logger = deps.logger ?? new WinstonLogger({ level: 'info' });
  const templatesRoot = options.templatesRoot ?? defaultTemplatesRoot();
  const configManager = new ConfigManager(files, { cwd });
  const claude = deps.claude ?? (await buildClaudeProvider(options, configManager, deps.env, files, cwd, logger));

  const service = new SpecService(
    { files, templateEngine, configManager, claude, logger },
    { cwd, templatesRoot },
  );

  const result = await service.generate({
    ...(options.outputPath !== undefined ? { outputPath: options.outputPath } : {}),
    ...(options.placeholders !== undefined ? { placeholders: options.placeholders } : {}),
    ...(options.update !== undefined ? { update: options.update } : {}),
  });

  printSummary(result);

  if (options.format !== undefined) {
    const exporter = pickExporter(options.format);
    const exportPath = options.exportPath ?? deriveExportPath(result.outputPath, options.format);
    await exporter.export({ markdown: result.markdown, outputPath: exportPath });
    console.log(`✔ Exported ${options.format.toUpperCase()} → ${exportPath}`);
  }

  return result;
}

function pickExporter(format: ExportFormat): ISpecExporter {
  switch (format) {
    case 'html':
    case 'pdf':
      return new PandocExporter(format);
    case 'confluence':
      return new ConfluenceExporter();
  }
}

function deriveExportPath(sddPath: string, format: ExportFormat): string {
  const base = sddPath.replace(/\.md$/i, '');
  switch (format) {
    case 'html':
      return `${base}.html`;
    case 'pdf':
      return `${base}.pdf`;
    case 'confluence':
      return `${base}.confluence`;
  }
}

async function buildClaudeProvider(
  options: SpecCommandOptions,
  configManager: ConfigManager,
  envOverride: SpecCommandDeps['env'],
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

function printSummary(result: SpecResult): void {
  console.log('');
  console.log(`✔ Wrote ${result.outputPath}`);
  for (const section of result.sections) {
    const tag = section.status === 'rendered' ? '✓' : section.status === 'placeholder' ? '⏭' : '∅';
    console.log(`  ${tag} ${section.title}`);
  }
}

export function buildSpecCommand(): Command {
  const cmd = new Command('spec');
  cmd
    .description('Generate the SDD markdown document from collected requirements + integrations')
    .option('-o, --output <file>', 'Output file path (default: docs/SDD.md)')
    .option('--placeholders', 'Render placeholders for skipped sections instead of omitting them')
    .option('--update', 'Re-render only sections whose inputs changed (uses .sdd/spec-cache.json)')
    .option('--format <kind>', 'Post-process to additional format: html | pdf | confluence')
    .option('--export-path <file>', 'Custom output path for the exported format')
    .action(
      async (opts: {
        output?: string;
        placeholders?: boolean;
        update?: boolean;
        format?: string;
        exportPath?: string;
      }) => {
        await runSpec({
          ...(opts.output !== undefined ? { outputPath: opts.output } : {}),
          ...(opts.placeholders !== undefined ? { placeholders: opts.placeholders } : {}),
          ...(opts.update !== undefined ? { update: opts.update } : {}),
          ...(opts.format !== undefined ? { format: opts.format as ExportFormat } : {}),
          ...(opts.exportPath !== undefined ? { exportPath: opts.exportPath } : {}),
        });
      },
    );
  return cmd;
}
