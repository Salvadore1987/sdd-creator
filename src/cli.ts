#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';

const program = new Command();

program
  .name('sdd')
  .description('Spec-anchored development CLI powered by Claude')
  .version('0.1.0');

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
