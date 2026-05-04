import { z } from 'zod';

import type { ClaudeCompleteOptions, IClaudeProvider } from '../../../src/ports/IClaudeProvider';

class FakeClaudeProvider implements IClaudeProvider {
  public readonly kind: 'cli' | 'api';
  public readonly seenOptions: ClaudeCompleteOptions[] = [];

  public constructor(kind: 'cli' | 'api', private readonly responder: (prompt: string) => string) {
    this.kind = kind;
  }

  public complete(prompt: string, opts?: ClaudeCompleteOptions): Promise<string> {
    if (opts !== undefined) {
      this.seenOptions.push(opts);
    }
    return Promise.resolve().then(() => this.responder(prompt));
  }

  public completeJson<T>(
    prompt: string,
    schema: z.ZodType<T>,
    opts?: ClaudeCompleteOptions,
  ): Promise<T> {
    if (opts !== undefined) {
      this.seenOptions.push(opts);
    }
    return Promise.resolve().then(() => schema.parse(JSON.parse(this.responder(prompt))));
  }
}

const factories: Array<{ name: string; create: () => IClaudeProvider }> = [
  {
    name: 'FakeClaudeProvider (cli kind)',
    create: () =>
      new FakeClaudeProvider(
        'cli',
        (prompt) => (prompt.includes('json') ? '{"value":42}' : 'NARRATIVE'),
      ),
  },
  {
    name: 'FakeClaudeProvider (api kind)',
    create: () =>
      new FakeClaudeProvider(
        'api',
        (prompt) => (prompt.includes('json') ? '{"value":7}' : 'API-NARRATIVE'),
      ),
  },
];

describe.each(factories)('IClaudeProvider contract — $name', ({ create }) => {
  it('exposes a kind discriminant of either "cli" or "api"', () => {
    // arrange + act
    const provider = create();

    // assert
    expect(['cli', 'api']).toContain(provider.kind);
  });

  it('complete() returns a string for any prompt', async () => {
    // arrange
    const provider = create();

    // act
    const out = await provider.complete('say hello');

    // assert
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('completeJson() parses according to the supplied Zod schema', async () => {
    // arrange
    const provider = create();
    const schema = z.object({ value: z.number() });

    // act
    const out = await provider.completeJson('return json', schema);

    // assert
    expect(typeof out.value).toBe('number');
  });

  it('completeJson() rejects when response does not satisfy schema', async () => {
    // arrange — provider returns {value: number} but we expect string
    const provider = create();
    const schema = z.object({ value: z.string() });

    // act
    const promise = provider.completeJson('return json', schema);

    // assert
    await expect(promise).rejects.toBeDefined();
  });

  it('accepts (and forwards) ClaudeCompleteOptions without throwing', async () => {
    // arrange
    const provider = create();
    const opts: ClaudeCompleteOptions = {
      model: 'claude-test',
      temperature: 0.0,
      maxTokens: 256,
    };

    // act
    await provider.complete('hi', opts);

    // assert
    if (provider instanceof FakeClaudeProvider) {
      expect(provider.seenOptions).toContainEqual(opts);
    }
  });
});
