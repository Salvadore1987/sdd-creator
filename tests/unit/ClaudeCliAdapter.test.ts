import type { ExecFileException, ExecFileOptions } from 'child_process';

import { ClaudeCliAdapter } from '../../src/adapters/ClaudeCliAdapter';
import type { ExecFileFn } from '../../src/adapters/ClaudeCliAdapter';
import { ClaudeCliAuthError, ClaudeCliNotInstalledError } from '../../src/ports/errors';
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

function makeExec(stdout: string, stderr = '', error: ExecFileException | null = null): ExecFileFn {
  const fn: ExecFileFn = (
    _file,
    _args: readonly string[],
    _options: ExecFileOptions,
    cb: (e: (ExecFileException & { stdout?: string; stderr?: string }) | null, out: string, err: string) => void,
  ) => {
    setImmediate(() => {
      cb(error, stdout, stderr);
    });
  };
  return fn;
}

describe('ClaudeCliAdapter', () => {
  it('extracts the result field from JSON stdout', async () => {
    // arrange
    const exec = makeExec(JSON.stringify({ result: 'hello' }));
    const adapter = new ClaudeCliAdapter({}, new NoopLogger(), exec);

    // act
    const out = await adapter.complete('hi');

    // assert
    expect(out).toBe('hello');
  });

  it('falls back to content blocks when no result field', async () => {
    // arrange
    const stdout = JSON.stringify({ content: [{ text: 'one' }, { text: 'two' }] });
    const exec = makeExec(stdout);
    const adapter = new ClaudeCliAdapter({}, new NoopLogger(), exec);

    // act
    const out = await adapter.complete('hi');

    // assert
    expect(out).toBe('one\ntwo');
  });

  it('returns trimmed raw text when stdout is not JSON', async () => {
    // arrange
    const exec = makeExec('plain answer\n');
    const adapter = new ClaudeCliAdapter({}, new NoopLogger(), exec);

    // act
    const out = await adapter.complete('hi');

    // assert
    expect(out).toBe('plain answer');
  });

  it('translates ENOENT to ClaudeCliNotInstalledError', async () => {
    // arrange
    const error = Object.assign(new Error('not found'), { code: 'ENOENT' }) as ExecFileException;
    const exec = makeExec('', '', error);
    const adapter = new ClaudeCliAdapter({ bin: '/nope' }, new NoopLogger(), exec);

    // act
    const promise = adapter.complete('hi');

    // assert
    await expect(promise).rejects.toBeInstanceOf(ClaudeCliNotInstalledError);
  });

  it('translates auth errors to ClaudeCliAuthError', async () => {
    // arrange
    const error = Object.assign(new Error('login required'), { code: 1 }) as ExecFileException;
    const exec = makeExec('', 'please run claude login', error);
    const adapter = new ClaudeCliAdapter({}, new NoopLogger(), exec);

    // act
    const promise = adapter.complete('hi');

    // assert
    await expect(promise).rejects.toBeInstanceOf(ClaudeCliAuthError);
  });
});
