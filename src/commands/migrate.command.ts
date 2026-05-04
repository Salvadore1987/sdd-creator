/* eslint-disable no-console */
import * as path from 'path';

import { Command } from 'commander';

import { FileRepository } from '../adapters/FileRepository';
import { Migrator } from '../domain/Migrator';
import type { IFileRepository } from '../ports/IFileRepository';
import { DEFAULTS } from '../utils/constants';

const TARGETS: ReadonlyArray<{ readonly key: string; readonly file: string }> = [
  { key: 'config', file: DEFAULTS.configFile },
  { key: 'requirements', file: DEFAULTS.requirementsFile },
  { key: 'integrations', file: DEFAULTS.integrationsFile },
];

export interface MigrateCommandOptions {
  readonly cwd?: string;
  readonly dryRun?: boolean;
}

export interface MigrateCommandDeps {
  readonly files?: IFileRepository;
}

export async function runMigrate(
  options: MigrateCommandOptions = {},
  deps: MigrateCommandDeps = {},
): Promise<{ readonly migrated: number; readonly checked: number }> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const migrator = new Migrator();
  let migrated = 0;
  let checked = 0;

  for (const target of TARGETS) {
    const filePath = path.join(cwd, target.file);
    if (!(await files.exists(filePath))) continue;
    checked += 1;
    const raw = await files.readJson<Record<string, unknown>>(filePath);
    const result = migrator.migrate(raw);
    if (!result.migrated) {
      console.log(`✓ ${target.key}: already at schema v${String(result.toVersion)}`);
      continue;
    }
    if (options.dryRun !== true) {
      await files.writeJson(filePath, result.document);
    }
    migrated += 1;
    console.log(
      `↑ ${target.key}: migrated v${String(result.fromVersion)} → v${String(result.toVersion)}${options.dryRun === true ? ' (dry-run)' : ''}`,
    );
  }
  console.log('');
  console.log(`Migrated ${String(migrated)} of ${String(checked)} document(s).`);
  return { migrated, checked };
}

export function buildMigrateCommand(): Command {
  const cmd = new Command('migrate');
  cmd
    .description('Apply schema migrations to .sdd/* documents')
    .option('--dry-run', 'Inspect required migrations without writing changes')
    .action(async (opts: { dryRun?: boolean }) => {
      await runMigrate({ ...(opts.dryRun !== undefined ? { dryRun: opts.dryRun } : {}) });
    });
  return cmd;
}
