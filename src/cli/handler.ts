/* eslint-disable no-console */
import {
  classifyError,
  type ClassifiedError,
  type ExitCode,
  type SddCliError,
} from './errors';

export interface HandleCliErrorOptions {
  readonly verbose?: boolean;
  readonly stderr?: (line: string) => void;
}

export function handleCliError(error: unknown, options: HandleCliErrorOptions = {}): ExitCode {
  const out = options.stderr ?? ((line: string): void => console.error(line));
  const classified: ClassifiedError = classifyError(error);
  const cli: SddCliError = classified.cliError;

  out(`✖ ${cli.message}`);
  if (cli.hint !== undefined && cli.hint !== '') {
    out(`  → ${cli.hint}`);
  }
  if (options.verbose === true) {
    const stack = (classified.original instanceof Error ? classified.original.stack : undefined) ?? cli.stack;
    if (stack !== undefined) {
      out('');
      out(stack);
    }
  } else {
    out('  (run with --verbose for stack trace)');
  }
  return cli.exitCode;
}
