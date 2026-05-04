import {
  ClaudeApiAuthError,
  ClaudeCliAuthError,
  ClaudeCliNotInstalledError,
  ClaudeProviderError,
  FileNotFoundError,
  JsonParseError,
  PermissionError,
} from '../ports/errors';

export const EXIT_CODES = {
  success: 0,
  generic: 1,
  validation: 2,
  provider: 3,
  filesystem: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export class SddCliError extends Error {
  public readonly exitCode: ExitCode;
  public readonly hint?: string;

  public constructor(message: string, exitCode: ExitCode, options: { hint?: string; cause?: unknown } = {}) {
    super(message);
    this.name = 'SddCliError';
    this.exitCode = exitCode;
    if (options.hint !== undefined) {
      this.hint = options.hint;
    }
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    Object.setPrototypeOf(this, SddCliError.prototype);
  }
}

export class ValidationError extends SddCliError {
  public constructor(message: string, options: { hint?: string; cause?: unknown } = {}) {
    super(message, EXIT_CODES.validation, options);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class LintFailedError extends SddCliError {
  public readonly errorCount: number;
  public readonly warningCount: number;

  public constructor(errorCount: number, warningCount: number) {
    super(`Lint failed: ${errorCount} errors, ${warningCount} warnings`, EXIT_CODES.validation);
    this.name = 'LintFailedError';
    this.errorCount = errorCount;
    this.warningCount = warningCount;
    Object.setPrototypeOf(this, LintFailedError.prototype);
  }
}

export class ProviderInvocationError extends SddCliError {
  public constructor(message: string, options: { hint?: string; cause?: unknown } = {}) {
    super(message, EXIT_CODES.provider, options);
    this.name = 'ProviderInvocationError';
    Object.setPrototypeOf(this, ProviderInvocationError.prototype);
  }
}

export class FileSystemError extends SddCliError {
  public readonly path: string;

  public constructor(message: string, path: string, options: { hint?: string; cause?: unknown } = {}) {
    super(message, EXIT_CODES.filesystem, options);
    this.name = 'FileSystemError';
    this.path = path;
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

export interface ClassifiedError {
  readonly cliError: SddCliError;
  readonly original: unknown;
}

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof SddCliError) {
    return { cliError: error, original: error };
  }
  if (error instanceof ClaudeCliNotInstalledError) {
    return {
      cliError: new ProviderInvocationError(error.message, {
        hint: 'Install: npm i -g @anthropic-ai/claude-code',
        cause: error,
      }),
      original: error,
    };
  }
  if (error instanceof ClaudeCliAuthError) {
    return {
      cliError: new ProviderInvocationError(error.message, {
        hint: 'Run: claude login',
        cause: error,
      }),
      original: error,
    };
  }
  if (error instanceof ClaudeApiAuthError) {
    return {
      cliError: new ProviderInvocationError(error.message, {
        hint: 'Set ANTHROPIC_API_KEY in your environment or .env',
        cause: error,
      }),
      original: error,
    };
  }
  if (error instanceof ClaudeProviderError) {
    return {
      cliError: new ProviderInvocationError(error.message, { cause: error }),
      original: error,
    };
  }
  if (error instanceof FileNotFoundError) {
    return {
      cliError: new FileSystemError(error.message, error.path, {
        hint: 'Run `sdd init` if you have not initialised this project yet.',
        cause: error,
      }),
      original: error,
    };
  }
  if (error instanceof PermissionError) {
    return {
      cliError: new FileSystemError(error.message, error.path, {
        hint: 'Check file permissions or run with appropriate privileges.',
        cause: error,
      }),
      original: error,
    };
  }
  if (error instanceof JsonParseError) {
    return {
      cliError: new ValidationError(`Invalid JSON: ${error.message}`, {
        hint: 'A document on disk could not be parsed. Inspect it manually or restore from backup.',
        cause: error,
      }),
      original: error,
    };
  }
  if (isZodError(error)) {
    return {
      cliError: new ValidationError(`Schema validation failed: ${error.message}`, {
        hint: 'A `.sdd/*.json` document does not match its schema. Run `sdd lint` for details.',
        cause: error,
      }),
      original: error,
    };
  }
  if (error instanceof Error) {
    return {
      cliError: new SddCliError(error.message, EXIT_CODES.generic, { cause: error }),
      original: error,
    };
  }
  return {
    cliError: new SddCliError(String(error), EXIT_CODES.generic, { cause: error }),
    original: error,
  };
}

function isZodError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'ZodError';
}
