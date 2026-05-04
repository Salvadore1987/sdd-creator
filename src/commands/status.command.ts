/* eslint-disable no-console */
import { Command } from 'commander';

import { FileRepository } from '../adapters/FileRepository';
import { StatusService, type StatusReport } from '../application/StatusService';
import type { IFileRepository } from '../ports/IFileRepository';

export interface StatusCommandOptions {
  readonly cwd?: string;
  readonly json?: boolean;
}

export interface StatusCommandDeps {
  readonly files?: IFileRepository;
}

export async function runStatus(
  options: StatusCommandOptions = {},
  deps: StatusCommandDeps = {},
): Promise<StatusReport> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const service = new StatusService({ files }, { cwd });
  const report = await service.report();

  if (options.json === true) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log('SDD status');
  console.log('');
  console.log('Section            Status      Count   Next');
  console.log('---------------    --------    -----   ----');
  for (const entry of report.entries) {
    const label = entry.label.padEnd(15);
    const status = String(entry.status).padEnd(8);
    const count = String(entry.count).padStart(5);
    console.log(`${label}    ${status}    ${count}   ${entry.nextCommand}`);
  }
  console.log('');
  const { completed, skipped, stale, pending } = report.summary;
  console.log(`Summary: ${completed} completed · ${skipped} skipped · ${stale} stale · ${pending} pending`);
  return report;
}

export function buildStatusCommand(): Command {
  const cmd = new Command('status');
  cmd
    .description('Show progress across SDD topics, integrations, ADRs and risks')
    .option('--json', 'Emit machine-readable JSON instead of a table')
    .action(async (opts: { json?: boolean }) => {
      await runStatus({ ...(opts.json !== undefined ? { json: opts.json } : {}) });
    });
  return cmd;
}
