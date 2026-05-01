import { z } from 'zod';

import { ClaudeApiAdapter } from '../../src/adapters/ClaudeApiAdapter';
import { ClaudeApiAuthError, ClaudeProviderError } from '../../src/ports/errors';
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

interface FakeClient {
  messages: {
    create: jest.Mock;
  };
}

function makeFakeClient(impl: jest.Mock): FakeClient {
  return { messages: { create: impl } };
}

describe('ClaudeApiAdapter', () => {
  it('returns concatenated text content', async () => {
    // arrange
    const create = jest.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' },
      ],
    });
    const adapter = new ClaudeApiAdapter(
      { apiKey: 'sk-test' },
      new NoopLogger(),
      makeFakeClient(create),
    );

    // act
    const result = await adapter.complete('hi');

    // assert
    expect(result).toBe('Hello\nWorld');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('parses JSON output against a schema', async () => {
    // arrange
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"x": 42}\n```' }],
    });
    const adapter = new ClaudeApiAdapter(
      { apiKey: 'sk-test' },
      new NoopLogger(),
      makeFakeClient(create),
    );
    const schema = z.object({ x: z.number() });

    // act
    const result = await adapter.completeJson('q', schema);

    // assert
    expect(result).toEqual({ x: 42 });
  });

  it('retries on 429 with exponential backoff and eventually succeeds', async () => {
    // arrange
    const rateLimited = Object.assign(new Error('429'), { status: 429, headers: { 'retry-after': '0' } });
    const create = jest
      .fn()
      .mockRejectedValueOnce(rateLimited)
      .mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const adapter = new ClaudeApiAdapter(
      { apiKey: 'sk-test', maxRetries: 1 },
      new NoopLogger(),
      makeFakeClient(create),
    );

    // act
    const result = await adapter.complete('p');

    // assert
    expect(result).toBe('ok');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('throws ClaudeApiAuthError on 401', async () => {
    // arrange
    const unauth = Object.assign(new Error('401'), { status: 401 });
    const create = jest.fn().mockRejectedValue(unauth);
    const adapter = new ClaudeApiAdapter(
      { apiKey: 'sk-test' },
      new NoopLogger(),
      makeFakeClient(create),
    );

    // act
    const promise = adapter.complete('p');

    // assert
    await expect(promise).rejects.toBeInstanceOf(ClaudeApiAuthError);
  });

  it('wraps unknown errors in ClaudeProviderError', async () => {
    // arrange
    const boom = new Error('boom');
    const create = jest.fn().mockRejectedValue(boom);
    const adapter = new ClaudeApiAdapter(
      { apiKey: 'sk-test' },
      new NoopLogger(),
      makeFakeClient(create),
    );

    // act
    const promise = adapter.complete('p');

    // assert
    await expect(promise).rejects.toBeInstanceOf(ClaudeProviderError);
  });
});
