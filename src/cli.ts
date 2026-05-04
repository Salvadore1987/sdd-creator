#!/usr/bin/env node
/* eslint-disable no-console */

import { Command, Option } from 'commander';

import { handleCliError } from './cli/handler';
import { buildBrainstormCommand } from './commands/brainstorm.command';
import { buildImportCommand } from './commands/import.command';
import { buildInitCommand } from './commands/init.command';
import { buildIntegrationsCommand } from './commands/integrations.command';
import {
  buildAddCommand,
  buildEditCommand,
  buildRemoveCommand,
} from './commands/lifecycle.command';
import { buildLintCommand } from './commands/lint.command';
import { buildMigrateCommand } from './commands/migrate.command';
import { buildSpecCommand } from './commands/spec.command';
import { buildStatusCommand } from './commands/status.command';
import { ENV_KEYS } from './utils/constants';

export interface BuildProgramOptions {
  readonly version?: string;
}

export function buildProgram(options: BuildProgramOptions = {}): Command {
  const program = new Command();
  program
    .name('sdd')
    .description('Spec-anchored development CLI powered by Claude')
    .version(options.version ?? '0.1.0')
    .addOption(
      new Option('--provider <kind>', 'Override Claude provider (cli|api)').choices(['cli', 'api']),
    )
    .option('--verbose', 'Enable debug logging (LOG_LEVEL=debug)')
    .hook('preAction', (thisCmd) => {
      const opts: { verbose?: boolean; provider?: 'cli' | 'api' } = thisCmd.optsWithGlobals();
      if (opts.verbose === true) {
        process.env[ENV_KEYS.logLevel] = 'debug';
      }
      if (opts.provider !== undefined) {
        process.env[ENV_KEYS.claudeProvider] = opts.provider;
      }
    });

  program.addCommand(buildInitCommand());
  program.addCommand(buildBrainstormCommand());
  program.addCommand(buildIntegrationsCommand());
  program.addCommand(buildSpecCommand());
  program.addCommand(buildStatusCommand());
  program.addCommand(buildAddCommand());
  program.addCommand(buildEditCommand());
  program.addCommand(buildRemoveCommand());
  program.addCommand(buildLintCommand());
  program.addCommand(buildImportCommand());
  program.addCommand(buildMigrateCommand());
  return program;
}

export async function main(argv: readonly string[] = process.argv): Promise<number> {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    const programOpts: { verbose?: boolean } = program.opts();
    const verbose = programOpts.verbose === true;
    return handleCliError(error, { verbose });
  }
}

if (require.main === module) {
  void main().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
