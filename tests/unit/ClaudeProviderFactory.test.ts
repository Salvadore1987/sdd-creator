import { ClaudeProviderFactory } from '../../src/adapters/ClaudeProviderFactory';
import { ClaudeApiAuthError } from '../../src/ports/errors';
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

describe('ClaudeProviderFactory', () => {
  it('prefers flag over env over config', () => {
    // arrange
    const factory = new ClaudeProviderFactory(new NoopLogger());

    // act
    const fromFlag = factory.resolveKind({ flag: 'api', env: 'cli', configValue: 'cli' });
    const fromEnv = factory.resolveKind({ env: 'api', configValue: 'cli' });
    const fromConfig = factory.resolveKind({ configValue: 'api' });

    // assert
    expect(fromFlag).toBe('api');
    expect(fromEnv).toBe('api');
    expect(fromConfig).toBe('api');
  });

  it('falls back to default cli when nothing is set', () => {
    // arrange
    const factory = new ClaudeProviderFactory(new NoopLogger());

    // act
    const kind = factory.resolveKind({});

    // assert
    expect(kind).toBe('cli');
  });

  it('ignores unknown values', () => {
    // arrange
    const factory = new ClaudeProviderFactory(new NoopLogger());

    // act
    const kind = factory.resolveKind({ flag: 'banana', env: 'gpt', configValue: 'cli' });

    // assert
    expect(kind).toBe('cli');
  });

  it('throws ClaudeApiAuthError when api kind requested without key', () => {
    // arrange
    const factory = new ClaudeProviderFactory(new NoopLogger());

    // act
    const fn = (): unknown => factory.create('api', {});

    // assert
    expect(fn).toThrow(ClaudeApiAuthError);
  });

  it('creates a CLI adapter when kind is cli', () => {
    // arrange
    const factory = new ClaudeProviderFactory(new NoopLogger());

    // act
    const provider = factory.create('cli', { cliBin: '/usr/local/bin/claude' });

    // assert
    expect(provider.kind).toBe('cli');
  });
});
