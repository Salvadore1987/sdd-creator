import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';

import { ClaudeApiAuthError, ClaudeProviderError } from '../ports/errors';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../ports/IClaudeProvider';
import type { ILogger } from '../ports/ILogger';
import { DEFAULTS } from '../utils/constants';

import { parseJsonWithSchema } from './json-extract';

export interface ClaudeApiAdapterOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly defaultModel?: string;
  readonly defaultMaxTokens?: number;
  readonly defaultTemperature?: number;
  readonly maxRetries?: number;
}

interface AnthropicLikeError {
  status?: number;
  headers?: Record<string, string | undefined> | undefined;
  message?: string;
}

interface AnthropicLikeClient {
  messages: {
    create(args: Record<string, unknown>): Promise<{ content?: ReadonlyArray<{ type?: string; text?: string }> }>;
  };
}

export class ClaudeApiAdapter implements IClaudeProvider {
  public readonly kind = 'api' as const;
  private readonly client: AnthropicLikeClient;
  private readonly logger: ILogger;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly maxRetries: number;

  public constructor(options: ClaudeApiAdapterOptions, logger: ILogger, client?: AnthropicLikeClient) {
    if (options.apiKey.trim() === '') {
      throw new ClaudeApiAuthError();
    }
    this.client =
      client ??
      (new Anthropic({
        apiKey: options.apiKey,
        ...(options.baseUrl !== undefined ? { baseURL: options.baseUrl } : {}),
      }) as unknown as AnthropicLikeClient);
    this.logger = logger.child({ component: 'ClaudeApiAdapter' });
    this.defaultModel = options.defaultModel ?? DEFAULTS.claudeModel;
    this.defaultMaxTokens = options.defaultMaxTokens ?? DEFAULTS.claudeMaxTokens;
    this.defaultTemperature = options.defaultTemperature ?? DEFAULTS.claudeTemperature;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public async complete(prompt: string, opts: ClaudeCompleteOptions = {}): Promise<string> {
    const args = this.buildArgs(prompt, opts);
    const response = await this.callWithRetry(args, 0);
    return this.extractText(response);
  }

  public async completeJson<T>(
    prompt: string,
    schema: ZodType<T>,
    opts: ClaudeCompleteOptions = {},
  ): Promise<T> {
    const text = await this.complete(prompt, opts);
    return parseJsonWithSchema(text, schema);
  }

  private buildArgs(prompt: string, opts: ClaudeCompleteOptions): Record<string, unknown> {
    const args: Record<string, unknown> = {
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? this.defaultMaxTokens,
      temperature: opts.temperature ?? this.defaultTemperature,
      messages: [{ role: 'user', content: prompt }],
    };
    if (opts.system !== undefined) {
      args.system = opts.system;
    }
    if (opts.stopSequences !== undefined && opts.stopSequences.length > 0) {
      args.stop_sequences = [...opts.stopSequences];
    }
    return args;
  }

  private async callWithRetry(
    args: Record<string, unknown>,
    attempt: number,
  ): Promise<{ content?: ReadonlyArray<{ type?: string; text?: string }> }> {
    try {
      return await this.client.messages.create(args);
    } catch (error) {
      const decision = this.classifyError(error);
      if (!decision.retryable || attempt >= this.maxRetries) {
        throw decision.error;
      }
      const delay = decision.retryAfterMs ?? this.backoffMs(attempt);
      this.logger.warn('Claude API call failed, retrying', {
        attempt: attempt + 1,
        delayMs: delay,
        reason: decision.error.message,
      });
      await sleep(delay);
      return this.callWithRetry(args, attempt + 1);
    }
  }

  private classifyError(error: unknown): {
    retryable: boolean;
    retryAfterMs?: number;
    error: ClaudeProviderError;
  } {
    const e = error as AnthropicLikeError;
    const status = e.status;
    if (status === 401 || status === 403) {
      return { retryable: false, error: new ClaudeApiAuthError() };
    }
    if (status === 429) {
      const retryAfter = parseRetryAfter(e.headers?.['retry-after']);
      return {
        retryable: true,
        ...(retryAfter !== undefined ? { retryAfterMs: retryAfter } : {}),
        error: new ClaudeProviderError('Rate limit exceeded (429)', true),
      };
    }
    if (status !== undefined && status >= 500 && status < 600) {
      return { retryable: true, error: new ClaudeProviderError(`Server error ${String(status)}`, true) };
    }
    const message = e.message ?? String(error);
    return { retryable: false, error: new ClaudeProviderError(message) };
  }

  private backoffMs(attempt: number): number {
    return Math.min(30_000, 500 * 2 ** attempt);
  }

  private extractText(response: { content?: ReadonlyArray<{ type?: string; text?: string }> }): string {
    const blocks = response.content ?? [];
    return blocks
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text ?? '')
      .join('\n');
  }
}

function parseRetryAfter(header: string | undefined): number | undefined {
  if (header === undefined) {
    return undefined;
  }
  const seconds = Number.parseFloat(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
