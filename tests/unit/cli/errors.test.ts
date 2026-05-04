import {
  classifyError,
  EXIT_CODES,
  FileSystemError,
  LintFailedError,
  ProviderInvocationError,
  SddCliError,
  ValidationError,
} from '../../../src/cli/errors';
import {
  ClaudeApiAuthError,
  ClaudeCliAuthError,
  ClaudeCliNotInstalledError,
  ClaudeProviderError,
  FileNotFoundError,
  JsonParseError,
  PermissionError,
} from '../../../src/ports/errors';

describe('cli/errors — exit code mapping', () => {
  it('exposes the canonical exit code dictionary', () => {
    // assert
    expect(EXIT_CODES.success).toBe(0);
    expect(EXIT_CODES.generic).toBe(1);
    expect(EXIT_CODES.validation).toBe(2);
    expect(EXIT_CODES.provider).toBe(3);
    expect(EXIT_CODES.filesystem).toBe(4);
  });

  it('SddCliError carries exit code and optional hint, retains instanceof', () => {
    // arrange + act
    const err = new SddCliError('boom', EXIT_CODES.generic, { hint: 'try again' });

    // assert
    expect(err).toBeInstanceOf(SddCliError);
    expect(err).toBeInstanceOf(Error);
    expect(err.exitCode).toBe(EXIT_CODES.generic);
    expect(err.hint).toBe('try again');
  });

  it('ValidationError sets exit code 2', () => {
    // arrange + act
    const err = new ValidationError('schema');

    // assert
    expect(err.exitCode).toBe(EXIT_CODES.validation);
  });

  it('LintFailedError records error/warning counts and uses validation exit code', () => {
    // arrange + act
    const err = new LintFailedError(2, 5);

    // assert
    expect(err.errorCount).toBe(2);
    expect(err.warningCount).toBe(5);
    expect(err.exitCode).toBe(EXIT_CODES.validation);
    expect(err.message).toContain('2 errors');
  });

  it('ProviderInvocationError uses provider exit code and forwards hint', () => {
    // arrange + act
    const err = new ProviderInvocationError('cli missing', { hint: 'install' });

    // assert
    expect(err.exitCode).toBe(EXIT_CODES.provider);
    expect(err.hint).toBe('install');
  });

  it('FileSystemError carries the offending path and uses filesystem exit code', () => {
    // arrange + act
    const err = new FileSystemError('not found', '/tmp/x');

    // assert
    expect(err.exitCode).toBe(EXIT_CODES.filesystem);
    expect(err.path).toBe('/tmp/x');
  });
});

describe('cli/errors — classifyError', () => {
  it('passes SddCliError through unchanged', () => {
    // arrange
    const original = new ValidationError('x');

    // act
    const out = classifyError(original);

    // assert
    expect(out.cliError).toBe(original);
  });

  it('maps ClaudeCliNotInstalledError → ProviderInvocationError with install hint', () => {
    // arrange
    const cause = new ClaudeCliNotInstalledError('/usr/bin/claude');

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError).toBeInstanceOf(ProviderInvocationError);
    expect(out.cliError.exitCode).toBe(EXIT_CODES.provider);
    expect(out.cliError.hint).toMatch(/claude-code/);
  });

  it('maps ClaudeCliAuthError → provider error with `claude login` hint', () => {
    // arrange
    const cause = new ClaudeCliAuthError();

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError.exitCode).toBe(EXIT_CODES.provider);
    expect(out.cliError.hint).toMatch(/claude login/);
  });

  it('maps ClaudeApiAuthError → provider error with API key hint', () => {
    // arrange
    const cause = new ClaudeApiAuthError();

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError.exitCode).toBe(EXIT_CODES.provider);
    expect(out.cliError.hint).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('maps generic ClaudeProviderError → provider error with no hardcoded hint', () => {
    // arrange
    const cause = new ClaudeProviderError('rate limited', true);

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError.exitCode).toBe(EXIT_CODES.provider);
  });

  it('maps FileNotFoundError → FileSystemError with init hint', () => {
    // arrange
    const cause = new FileNotFoundError('/no/such/.sdd/config.json');

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError).toBeInstanceOf(FileSystemError);
    expect(out.cliError.exitCode).toBe(EXIT_CODES.filesystem);
    expect(out.cliError.hint).toMatch(/sdd init/);
  });

  it('maps PermissionError → FileSystemError with permission hint', () => {
    // arrange
    const cause = new PermissionError('/etc/secret');

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError.exitCode).toBe(EXIT_CODES.filesystem);
    expect(out.cliError.hint).toMatch(/permission/i);
  });

  it('maps JsonParseError → ValidationError', () => {
    // arrange
    const cause = new JsonParseError('unexpected token', '{bad');

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError).toBeInstanceOf(ValidationError);
    expect(out.cliError.exitCode).toBe(EXIT_CODES.validation);
  });

  it('maps a ZodError-shaped error → ValidationError', () => {
    // arrange
    const cause = new Error('Expected string, got number');
    cause.name = 'ZodError';

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError).toBeInstanceOf(ValidationError);
    expect(out.cliError.exitCode).toBe(EXIT_CODES.validation);
  });

  it('maps an arbitrary Error → SddCliError(generic)', () => {
    // arrange
    const cause = new Error('boom');

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError.exitCode).toBe(EXIT_CODES.generic);
    expect(out.cliError.message).toBe('boom');
  });

  it('stringifies non-Error throwables', () => {
    // arrange
    const cause = 'literal string error';

    // act
    const out = classifyError(cause);

    // assert
    expect(out.cliError.exitCode).toBe(EXIT_CODES.generic);
    expect(out.cliError.message).toBe('literal string error');
  });
});
