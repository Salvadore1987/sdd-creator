import { WinstonLogger } from '../../../src/adapters/WinstonLogger';
import type { ILogger, LogFields } from '../../../src/ports/ILogger';

class CapturingLogger implements ILogger {
  public readonly entries: Array<{
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields: LogFields;
  }> = [];
  public readonly bindings: LogFields;

  public constructor(bindings: LogFields = {}) {
    this.bindings = bindings;
  }

  public debug(message: string, fields?: LogFields): void {
    this.entries.push({ level: 'debug', message, fields: { ...this.bindings, ...(fields ?? {}) } });
  }
  public info(message: string, fields?: LogFields): void {
    this.entries.push({ level: 'info', message, fields: { ...this.bindings, ...(fields ?? {}) } });
  }
  public warn(message: string, fields?: LogFields): void {
    this.entries.push({ level: 'warn', message, fields: { ...this.bindings, ...(fields ?? {}) } });
  }
  public error(message: string, fields?: LogFields): void {
    this.entries.push({ level: 'error', message, fields: { ...this.bindings, ...(fields ?? {}) } });
  }
  public child(bindings: LogFields): ILogger {
    return new CapturingLogger({ ...this.bindings, ...bindings });
  }
}

const factories: Array<{ name: string; create: () => ILogger }> = [
  { name: 'WinstonLogger', create: () => new WinstonLogger({ level: 'error' }) },
  { name: 'CapturingLogger (in-memory)', create: () => new CapturingLogger() },
];

describe.each(factories)('ILogger contract — $name', ({ create }) => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('exposes the four standard log levels as callable methods', () => {
    // arrange
    const logger = create();

    // assert
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('accepts a structured fields object alongside the message', () => {
    // arrange
    const logger = create();

    // act + assert — must not throw
    expect(() => logger.info('hello', { topic: 'features', count: 3 })).not.toThrow();
  });

  it('child() returns a new logger of the same shape', () => {
    // arrange
    const logger = create();

    // act
    const child = logger.child({ component: 'spec' });

    // assert
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
    expect(typeof child.child).toBe('function');
    expect(() => child.warn('something', { detail: true })).not.toThrow();
  });

  it('accepts log calls without a fields argument', () => {
    // arrange
    const logger = create();

    // act + assert
    expect(() => logger.error('boom')).not.toThrow();
  });
});

describe('CapturingLogger captures fields and bindings (sanity check for the in-memory impl)', () => {
  it('child bindings are merged into subsequent log entries', () => {
    // arrange
    const logger = new CapturingLogger();
    const child = logger.child({ component: 'spec' });

    // act
    child.info('rendered', { section: 'overview' });

    // assert
    const captured = (child as CapturingLogger).entries[0];
    expect(captured?.fields).toMatchObject({ component: 'spec', section: 'overview' });
  });
});
