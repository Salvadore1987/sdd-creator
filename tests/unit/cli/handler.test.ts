import {
  EXIT_CODES,
  ProviderInvocationError,
  ValidationError,
} from '../../../src/cli/errors';
import { handleCliError } from '../../../src/cli/handler';
import { ClaudeCliAuthError } from '../../../src/ports/errors';

describe('handleCliError', () => {
  it('returns the SddCliError exit code', () => {
    // arrange
    const lines: string[] = [];
    const error = new ValidationError('schema failed', { hint: 'fix it' });

    // act
    const code = handleCliError(error, { stderr: (l) => lines.push(l) });

    // assert
    expect(code).toBe(EXIT_CODES.validation);
  });

  it('prints the message, hint, and (without --verbose) a stack-trace prompt', () => {
    // arrange
    const lines: string[] = [];
    const error = new ProviderInvocationError('cli not found', { hint: 'install' });

    // act
    handleCliError(error, { stderr: (l) => lines.push(l) });

    // assert
    expect(lines[0]).toContain('cli not found');
    expect(lines.some((l) => l.includes('install'))).toBe(true);
    expect(lines.some((l) => l.includes('--verbose'))).toBe(true);
  });

  it('prints stack trace when --verbose is set', () => {
    // arrange
    const lines: string[] = [];
    const error = new Error('boom');

    // act
    handleCliError(error, { verbose: true, stderr: (l) => lines.push(l) });

    // assert
    expect(lines.some((l) => l.includes('boom'))).toBe(true);
    expect(lines.some((l) => l.includes('at '))).toBe(true);
  });

  it('classifies a known ports error and uses its exit code (provider, code 3)', () => {
    // arrange
    const lines: string[] = [];
    const error = new ClaudeCliAuthError();

    // act
    const code = handleCliError(error, { stderr: (l) => lines.push(l) });

    // assert
    expect(code).toBe(EXIT_CODES.provider);
    expect(lines.some((l) => l.includes('claude login'))).toBe(true);
  });

  it('falls back to generic exit code 1 for arbitrary Error', () => {
    // arrange
    const error = new Error('mystery');

    // act
    const code = handleCliError(error, { stderr: () => {} });

    // assert
    expect(code).toBe(EXIT_CODES.generic);
  });
});
