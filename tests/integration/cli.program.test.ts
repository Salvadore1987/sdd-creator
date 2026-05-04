import { buildProgram } from '../../src/cli';
import { ENV_KEYS } from '../../src/utils/constants';

describe('buildProgram (integration)', () => {
  const ORIGINAL_LOG_LEVEL = process.env[ENV_KEYS.logLevel];
  const ORIGINAL_PROVIDER = process.env[ENV_KEYS.claudeProvider];

  afterEach(() => {
    if (ORIGINAL_LOG_LEVEL === undefined) {
      delete process.env[ENV_KEYS.logLevel];
    } else {
      process.env[ENV_KEYS.logLevel] = ORIGINAL_LOG_LEVEL;
    }
    if (ORIGINAL_PROVIDER === undefined) {
      delete process.env[ENV_KEYS.claudeProvider];
    } else {
      process.env[ENV_KEYS.claudeProvider] = ORIGINAL_PROVIDER;
    }
  });

  it('registers the canonical command surface', () => {
    // arrange + act
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());

    // assert
    expect(names).toEqual(
      expect.arrayContaining([
        'init',
        'brainstorm',
        'integrations',
        'spec',
        'status',
        'add',
        'edit',
        'remove',
        'lint',
        'import',
        'migrate',
      ]),
    );
  });

  it('--verbose preAction hook flips LOG_LEVEL to debug', async () => {
    // arrange
    delete process.env[ENV_KEYS.logLevel];
    const program = buildProgram();
    program
      .command('noop-test')
      .description('test-only no-op')
      .action(() => {});

    // act
    await program.parseAsync(['node', 'sdd', '--verbose', 'noop-test']);

    // assert
    expect(process.env[ENV_KEYS.logLevel]).toBe('debug');
  });

  it('--provider preAction hook sets SDD_CLAUDE_PROVIDER', async () => {
    // arrange
    delete process.env[ENV_KEYS.claudeProvider];
    const program = buildProgram();
    program
      .command('noop-test-provider')
      .description('test-only no-op')
      .action(() => {});

    // act
    await program.parseAsync(['node', 'sdd', '--provider', 'api', 'noop-test-provider']);

    // assert
    expect(process.env[ENV_KEYS.claudeProvider]).toBe('api');
  });
});
