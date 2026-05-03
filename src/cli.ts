#!/usr/bin/env node
/* eslint-disable no-console */

import { Command, Option } from 'commander';

import { buildBrainstormCommand } from './commands/brainstorm.command';
import { buildInitCommand } from './commands/init.command';

const program = new Command();

program
  .name('sdd')
  .description('Spec-anchored development CLI powered by Claude')
  .version('0.1.0')
  .addOption(new Option('--provider <kind>', 'Override Claude provider (cli|api)').choices(['cli', 'api']))
  .option('--verbose', 'Enable debug logging');

program.addCommand(buildInitCommand());
program.addCommand(buildBrainstormCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
