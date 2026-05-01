import { execFile } from 'child_process';
import type { ExecFileException, ExecFileOptions } from 'child_process';

import type { ZodType } from 'zod';

import { ClaudeCliAuthError, ClaudeCliNotInstalledError, ClaudeProviderError } from '../ports/errors';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../ports/IClaudeProvider';
import type { ILogger } from '../ports/ILogger';
import { DEFAULTS } from '../utils/constants';

import { parseJsonWithSchema } from './json-extract';

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
  callback: (
    error: (ExecFileException & { stdout?: string; stderr?: string }) | null,
    stdout: string,
    stderr: string,
  ) => void,
) => void;

export interface ClaudeCliAdapterOptions {
  readonly bin?: string;
  readonly timeoutMs?: number;
  readonly defaultModel?: string;
  readonly extraArgs?: readonly string[];
}

export class ClaudeCliAdapter implements IClaudeProvider {
  public readonly kind = 'cli' as const;
  private readonly bin: string;
  private readonly timeoutMs: number;
  private readonly defaultModel: string | undefined;
  private readonly extraArgs: readonly string[];
  private readonly logger: ILogger;
  private readonly exec: ExecFileFn;

  public constructor(options: ClaudeCliAdapterOptions, logger: ILogger, exec?: ExecFileFn) {
    this.bin = options.bin ?? DEFAULTS.claudeCliBin;
    this.timeoutMs = options.timeoutMs ?? DEFAULTS.claudeCliTimeoutMs;
    this.defaultModel = options.defaultModel;
    this.extraArgs = options.extraArgs ?? [];
    this.logger = logger.child({ component: 'ClaudeCliAdapter', bin: this.bin });
    this.exec = exec ?? (execFile as ExecFileFn);
  }

  public async complete(prompt: string, opts: ClaudeCompleteOptions = {}): Promise<string> {
    const args = this.buildArgs(opts);
    const stdout = await this.run(args, prompt);
    return this.extractText(stdout);
  }

  public async completeJson<T>(
    prompt: string,
    schema: ZodType<T>,
    opts: ClaudeCompleteOptions = {},
  ): Promise<T> {
    const text = await this.complete(prompt, opts);
    return parseJsonWithSchema(text, schema);
  }

  private buildArgs(opts: ClaudeCompleteOptions): string[] {
    const args = ['-p', '--output-format', 'json'];
    const model = opts.model ?? this.defaultModel;
    if (model !== undefined) {
      args.push('--model', model);
    }
    args.push(...this.extraArgs);
    return args;
  }

  private run(args: readonly string[], stdin: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.exec(
        this.bin,
        args,
        { timeout: this.timeoutMs, maxBuffer: 16 * 1024 * 1024, shell: false },
        (error, stdout, stderr) => {
          if (error) {
            reject(this.translateError(error, stderr));
            return;
          }
          resolve(stdout);
        },
      ) as unknown as { stdin?: NodeJS.WritableStream } | undefined;
      const stream = child?.stdin;
      if (stream) {
        stream.end(stdin);
      }
    });
  }

  private translateError(
    error: ExecFileException & { stdout?: string; stderr?: string },
    stderr: string,
  ): Error {
    if (error.code === 'ENOENT') {
      return new ClaudeCliNotInstalledError(this.bin);
    }
    const merged = `${stderr}\n${error.stderr ?? ''}\n${error.message}`.toLowerCase();
    if (merged.includes('not authenticated') || merged.includes('claude login') || merged.includes('unauthorized')) {
      return new ClaudeCliAuthError();
    }
    if (error.killed) {
      this.logger.error('Claude CLI timed out', { timeoutMs: this.timeoutMs });
      return new ClaudeProviderError(`Claude CLI timed out after ${String(this.timeoutMs)}ms`, true);
    }
    return new ClaudeProviderError(`Claude CLI failed: ${error.message}`);
  }

  private extractText(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return '';
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const text = pickStringField(parsed, ['result', 'response', 'text', 'output']);
      if (text !== undefined) {
        return text;
      }
      const messageContent = pickContentBlocks(parsed);
      if (messageContent !== undefined) {
        return messageContent;
      }
    } catch {
      // not JSON — return raw text
    }
    return trimmed;
  }
}

function pickStringField(value: unknown, keys: readonly string[]): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string') {
      return v;
    }
  }
  return undefined;
}

function pickContentBlocks(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  const content = obj.content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const texts = content
    .map((block) => {
      if (typeof block === 'object' && block !== null) {
        const t = (block as Record<string, unknown>).text;
        return typeof t === 'string' ? t : '';
      }
      return '';
    })
    .filter((s) => s !== '');
  return texts.length > 0 ? texts.join('\n') : undefined;
}
