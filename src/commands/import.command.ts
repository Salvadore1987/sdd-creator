/* eslint-disable no-console */
import * as path from 'path';

import { Command } from 'commander';

import { FileRepository } from '../adapters/FileRepository';
import { JiraJsonImporter } from '../adapters/req-importers/JiraJsonImporter';
import { LinearJsonImporter } from '../adapters/req-importers/LinearJsonImporter';
import { MarkdownRequirementImporter } from '../adapters/req-importers/MarkdownRequirementImporter';
import { RequirementsItemService } from '../application/RequirementsItemService';
import type { Requirement } from '../domain/models';
import type { IFileRepository } from '../ports/IFileRepository';
import type {
  IRequirementImporter,
  RequirementImportFormat,
} from '../ports/IRequirementImporter';

export interface ImportCommandOptions {
  readonly cwd?: string;
  readonly format: RequirementImportFormat;
  readonly file: string;
}

export interface ImportCommandDeps {
  readonly files?: IFileRepository;
  readonly importers?: readonly IRequirementImporter[];
}

export async function runImport(
  options: ImportCommandOptions,
  deps: ImportCommandDeps = {},
): Promise<readonly Requirement[]> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const importers =
    deps.importers ??
    ([
      new MarkdownRequirementImporter(files),
      new JiraJsonImporter(files),
      new LinearJsonImporter(files),
    ] as readonly IRequirementImporter[]);
  const importer = importers.find((i) => i.canImport(options.format));
  if (importer === undefined) {
    throw new Error(`No importer registered for format "${options.format}"`);
  }

  const absolute = path.isAbsolute(options.file) ? options.file : path.resolve(cwd, options.file);
  const drafts = await importer.import(absolute);
  const itemService = new RequirementsItemService({ files }, { cwd });
  const created: Requirement[] = [];
  for (const draft of drafts) {
    const requirement = await itemService.addFeature(draft);
    created.push(requirement);
    console.log(`✔ ${requirement.id} ${requirement.title}`);
  }
  console.log(`Imported ${String(created.length)} feature(s) from ${options.format}`);
  return created;
}

export function buildImportCommand(): Command {
  const cmd = new Command('import');
  cmd
    .description('Import features from external trackers (Jira/Linear) or markdown')
    .requiredOption('--from <format>', 'Source format: md | jira | linear')
    .requiredOption('--file <path>', 'Path to the export file')
    .action(async (opts: { from: string; file: string }) => {
      await runImport({
        format: opts.from as RequirementImportFormat,
        file: opts.file,
      });
    });
  return cmd;
}
