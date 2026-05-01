export class FileNotFoundError extends Error {
  public readonly path: string;

  public constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
    this.path = path;
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

export class PermissionError extends Error {
  public readonly path: string;

  public constructor(path: string, cause?: unknown) {
    super(`Permission denied: ${path}`);
    this.name = 'PermissionError';
    this.path = path;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

export class ClaudeProviderError extends Error {
  public readonly retryable: boolean;

  public constructor(message: string, retryable = false) {
    super(message);
    this.name = 'ClaudeProviderError';
    this.retryable = retryable;
    Object.setPrototypeOf(this, ClaudeProviderError.prototype);
  }
}

export class ClaudeCliNotInstalledError extends ClaudeProviderError {
  public constructor(binPath: string) {
    super(
      `Claude CLI binary not found at "${binPath}". Install it with: npm i -g @anthropic-ai/claude-code`,
      false,
    );
    this.name = 'ClaudeCliNotInstalledError';
    Object.setPrototypeOf(this, ClaudeCliNotInstalledError.prototype);
  }
}

export class ClaudeCliAuthError extends ClaudeProviderError {
  public constructor() {
    super('Claude CLI is not authenticated. Run: claude login', false);
    this.name = 'ClaudeCliAuthError';
    Object.setPrototypeOf(this, ClaudeCliAuthError.prototype);
  }
}

export class ClaudeApiAuthError extends ClaudeProviderError {
  public constructor() {
    super('ANTHROPIC_API_KEY is missing or invalid', false);
    this.name = 'ClaudeApiAuthError';
    Object.setPrototypeOf(this, ClaudeApiAuthError.prototype);
  }
}

export class JsonParseError extends Error {
  public readonly raw: string;

  public constructor(message: string, raw: string) {
    super(message);
    this.name = 'JsonParseError';
    this.raw = raw;
    Object.setPrototypeOf(this, JsonParseError.prototype);
  }
}
