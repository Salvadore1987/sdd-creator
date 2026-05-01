import { CachingClaudeProvider } from '../../src/adapters/CachingClaudeProvider';
import { FileNotFoundError } from '../../src/ports/errors';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
import type { IFileRepository } from '../../src/ports/IFileRepository';
import type { ILogger } from '../../src/ports/ILogger';

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

class InMemoryFileRepository implements IFileRepository {
  public readonly store = new Map<string, string>();

  public read(path: string): Promise<string> {
    const v = this.store.get(path);
    return v === undefined ? Promise.reject(new FileNotFoundError(path)) : Promise.resolve(v);
  }
  public async readJson<T>(path: string): Promise<T> {
    return JSON.parse(await this.read(path)) as T;
  }
  public write(path: string, content: string): Promise<void> {
    this.store.set(path, content);
    return Promise.resolve();
  }
  public async writeJson(path: string, value: unknown): Promise<void> {
    await this.write(path, JSON.stringify(value));
  }
  public exists(path: string): Promise<boolean> {
    return Promise.resolve(this.store.has(path));
  }
  public mkdir(): Promise<void> {
    return Promise.resolve();
  }
  public remove(): Promise<void> {
    return Promise.resolve();
  }
  public list(): Promise<readonly string[]> {
    return Promise.resolve(Array.from(this.store.keys()));
  }
}

class CountingProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;
  public calls = 0;
  public constructor(private readonly response: string = 'fresh') {}
  public complete(_p: string, _o?: ClaudeCompleteOptions): Promise<string> {
    this.calls += 1;
    return Promise.resolve(this.response);
  }
  public completeJson<T>(): Promise<T> {
    return Promise.reject(new Error('not used'));
  }
}

describe('CachingClaudeProvider', () => {
  it('caches identical prompts', async () => {
    // arrange
    const inner = new CountingProvider();
    const files = new InMemoryFileRepository();
    const cached = new CachingClaudeProvider(inner, files, new NoopLogger(), {
      cacheDir: '/cache',
    });

    // act
    const a = await cached.complete('same prompt');
    const b = await cached.complete('same prompt');

    // assert
    expect(a).toBe('fresh');
    expect(b).toBe('fresh');
    expect(inner.calls).toBe(1);
  });

  it('treats different opts as different keys', async () => {
    // arrange
    const inner = new CountingProvider();
    const files = new InMemoryFileRepository();
    const cached = new CachingClaudeProvider(inner, files, new NoopLogger(), {
      cacheDir: '/cache',
    });

    // act
    await cached.complete('p', { temperature: 0 });
    await cached.complete('p', { temperature: 1 });

    // assert
    expect(inner.calls).toBe(2);
  });

  it('expires entries past TTL', async () => {
    // arrange
    const inner = new CountingProvider();
    const files = new InMemoryFileRepository();
    let now = 1_000;
    const cached = new CachingClaudeProvider(inner, files, new NoopLogger(), {
      cacheDir: '/cache',
      ttlMs: 100,
      clock: () => now,
    });

    // act
    await cached.complete('p');
    now += 1_000;
    await cached.complete('p');

    // assert
    expect(inner.calls).toBe(2);
  });

  it('bypasses cache when disabled', async () => {
    // arrange
    const inner = new CountingProvider();
    const files = new InMemoryFileRepository();
    const cached = new CachingClaudeProvider(inner, files, new NoopLogger(), {
      cacheDir: '/cache',
      enabled: false,
    });

    // act
    await cached.complete('p');
    await cached.complete('p');

    // assert
    expect(inner.calls).toBe(2);
  });
});
