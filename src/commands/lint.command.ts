/* eslint-disable no-console */
import { Command } from 'commander';

import { FileRepository } from '../adapters/FileRepository';
import { LintService, type LintReport } from '../application/LintService';
import type { IFileRepository } from '../ports/IFileRepository';

export interface LintCommandOptions {
  readonly cwd?: string;
  readonly strict?: boolean;
  readonly warningsAsErrors?: boolean;
  readonly sddPath?: string;
}

export interface LintCommandDeps {
  readonly files?: IFileRepository;
}

export async function runLint(
  options: LintCommandOptions = {},
  deps: LintCommandDeps = {},
): Promise<{ report: LintReport; exitCode: number }> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const service = new LintService({ files }, { cwd });
  const report = await service.run({
    ...(options.strict !== undefined ? { strict: options.strict } : {}),
    ...(options.sddPath !== undefined ? { sddPath: options.sddPath } : {}),
  });

  if (report.findings.length === 0) {
    console.log('✔ No issues found.');
  } else {
    for (const finding of report.findings) {
      const sev = finding.severity === 'error' ? 'ERR ' : 'WARN';
      console.log(`${sev} ${finding.rule.padEnd(28)} ${finding.path}\n     ${finding.message}`);
    }
    console.log('');
    console.log(`${report.errorCount} errors · ${report.warningCount} warnings`);
  }

  let exitCode = service.exitCodeFor(report);
  if (options.warningsAsErrors === true && exitCode === 2) {
    exitCode = 1;
  }
  return { report, exitCode };
}

export function buildLintCommand(): Command {
  const cmd = new Command('lint');
  cmd
    .description('Lint requirements + integrations + rendered SDD against the arc42 checklist')
    .option('--strict', 'Treat skipped sections + missing arc42 coverage as errors')
    .option('--warnings-as-errors', 'Promote exit code 2 (warnings only) to 1 (CI gate)')
    .option('--spec <file>', 'Path to the rendered SDD (default: docs/SDD.md)')
    .action(async (opts: { strict?: boolean; warningsAsErrors?: boolean; spec?: string }) => {
      const result = await runLint({
        ...(opts.strict !== undefined ? { strict: opts.strict } : {}),
        ...(opts.warningsAsErrors !== undefined ? { warningsAsErrors: opts.warningsAsErrors } : {}),
        ...(opts.spec !== undefined ? { sddPath: opts.spec } : {}),
      });
      process.exit(result.exitCode);
    });
  return cmd;
}
