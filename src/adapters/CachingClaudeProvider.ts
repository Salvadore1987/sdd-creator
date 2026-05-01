import { createHash } from 'crypto';
import * as path from 'path';

import type { ZodType } from 'zod';

import type {
  ClaudeCompleteOptions,
  IClaudeProvider,
} from '../ports/IClaudeProvider';
import type { IFileRepository } from '../ports/IFileRepository';
import type { ILogger } from '../ports/ILogger';

import { parseJsonWithSchema } from './json-extract';

export interface CachingClaudeProviderOptions {
  readonly cacheDir: string;
  readonly enabled?: boolean;
  readonly ttlMs?: number;
  readonly clock?: () => number;
}

interface CacheEntry {
  readonly model: string | undefined;
  readonly prompt: string;
  readonly opts: Readonly<Record<string, unknown>>;
  readonly response: string;
  readonly storedAt: number;
}

export class CachingClaudeProvider implements IClaudeProvider {
  public readonly kind: 'cli' | 'api';
  private readonly inner: IClaudeProvider;
  private readonly files: IFileRepository;
  private readonly logger: ILogger;
  private readonly cacheDir: string;
  private readonly enabled: boolean;
  private readonly ttlMs: number | undefined;
  private readonly clock: () => number;

  public constructor(
    inner: IClaudeProvider,
    files: IFileRepository,
    logger: ILogger,
    options: CachingClaudeProviderOptions,
  ) {
    this.inner = inner;
    this.files = files;
    this.logger = logger.child({ component: 'CachingClaudeProvider' });
    this.cacheDir = options.cacheDir;
    this.enabled = options.enabled ?? true;
    this.ttlMs = options.ttlMs;
    this.clock = options.clock ?? Date.now;
    this.kind = inner.kind;
  }

  public async complete(prompt: string, opts: ClaudeCompleteOptions = {}): Promise<string> {
    if (!this.enabled) {
      return this.inner.complete(prompt, opts);
    }
    const key = this.computeKey(prompt, opts);
    const cached = await this.read(key);
    if (cached !== null && this.isFresh(cached)) {
      this.logger.debug('cache hit', { key });
      return cached.response;
    }
    const response = await this.inner.complete(prompt, opts);
    await this.write(key, prompt, opts, response);
    return response;
  }

  public async completeJson<T>(
    prompt: string,
    schema: ZodType<T>,
    opts: ClaudeCompleteOptions = {},
  ): Promise<T> {
    const text = await this.complete(prompt, opts);
    return parseJsonWithSchema(text, schema);
  }

  private computeKey(prompt: string, opts: ClaudeCompleteOptions): string {
    const payload = JSON.stringify({
      kind: this.inner.kind,
      model: opts.model,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      system: opts.system,
      stop: opts.stopSequences,
      prompt,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private async read(key: string): Promise<CacheEntry | null> {
    const file = this.entryPath(key);
    try {
      return await this.files.readJson<CacheEntry>(file);
    } catch {
      return null;
    }
  }

  private async write(
    key: string,
    prompt: string,
    opts: ClaudeCompleteOptions,
    response: string,
  ): Promise<void> {
    const entry: CacheEntry = {
      model: opts.model,
      prompt,
      opts: {
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        system: opts.system,
        stop: opts.stopSequences,
      },
      response,
      storedAt: this.clock(),
    };
    await this.files.writeJson(this.entryPath(key), entry);
  }

  private isFresh(entry: CacheEntry): boolean {
    if (this.ttlMs === undefined) {
      return true;
    }
    return this.clock() - entry.storedAt <= this.ttlMs;
  }

  private entryPath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }
}
