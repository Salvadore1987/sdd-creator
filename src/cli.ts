#!/usr/bin/env node
/* eslint-disable no-console */

import { Command, Option } from 'commander';

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

const program = new Command();

program
  .name('sdd')
  .description('Spec-anchored development CLI powered by Claude')
  .version('0.1.0')
  .addOption(new Option('--provider <kind>', 'Override Claude provider (cli|api)').choices(['cli', 'api']))
  .option('--verbose', 'Enable debug logging');

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

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
