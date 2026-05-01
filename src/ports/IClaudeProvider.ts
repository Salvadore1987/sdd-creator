import type { ZodType } from 'zod';

export interface ClaudeCompleteOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly system?: string;
  readonly stopSequences?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface IClaudeProvider {
  readonly kind: 'cli' | 'api';
  complete(prompt: string, opts?: ClaudeCompleteOptions): Promise<string>;
  completeJson<T>(prompt: string, schema: ZodType<T>, opts?: ClaudeCompleteOptions): Promise<T>;
  countTokens?(prompt: string): Promise<number>;
}
