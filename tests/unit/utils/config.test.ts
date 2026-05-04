import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  applyEnvDefaults,
  loadDotEnv,
  parseDotEnv,
  pickEnv,
  resolveCwdRelative,
} from '../../../src/utils/config';

describe('utils/config', () => {
  describe('parseDotEnv', () => {
    it('parses key=value pairs ignoring comments and blank lines', () => {
      // arrange
      const raw = '# comment\n\nFOO=bar\nBAZ=qux\n';

      // act
      const out = parseDotEnv(raw);

      // assert
      expect(out).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('strips matching surrounding quotes (single and double)', () => {
      // arrange
      const raw = `A="hello"\nB='world'\nC=raw`;

      // act
      const out = parseDotEnv(raw);

      // assert
      expect(out).toEqual({ A: 'hello', B: 'world', C: 'raw' });
    });

    it('skips lines without `=` and lines with empty keys', () => {
      // arrange
      const raw = 'INVALID_LINE\n=novalue\nOK=1';

      // act
      const out = parseDotEnv(raw);

      // assert
      expect(out).toEqual({ OK: '1' });
    });
  });

  describe('loadDotEnv', () => {
    it('returns the parsed env when the file exists', async () => {
      // arrange
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-env-'));
      const file = path.join(dir, '.env');
      await fs.writeFile(file, 'FOO=bar\n');

      try {
        // act
        const out = await loadDotEnv(file);

        // assert
        expect(out).toEqual({ FOO: 'bar' });
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('returns an empty object when the file is missing', async () => {
      // arrange
      const file = path.join(os.tmpdir(), `no-such-${Date.now()}.env`);

      // act
      const out = await loadDotEnv(file);

      // assert
      expect(out).toEqual({});
    });
  });

  describe('applyEnvDefaults', () => {
    it('overrides defaults with environment values', () => {
      // arrange
      const env = { FOO: 'env', BAR: undefined } as const;
      const defaults = { FOO: 'default', BAZ: 'd' };

      // act
      const out = applyEnvDefaults(env, defaults);

      // assert
      expect(out.FOO).toBe('env');
      expect(out.BAZ).toBe('d');
    });
  });

  describe('pickEnv', () => {
    it('reads the well-known SDD/Anthropic env keys', () => {
      // arrange
      const env = {
        SDD_CLAUDE_PROVIDER: 'cli',
        SDD_CLAUDE_CLI_BIN: '/usr/local/bin/claude',
        SDD_CLAUDE_CLI_TIMEOUT_MS: '30000',
        SDD_CLAUDE_MODEL: 'claude-opus-4-7',
        ANTHROPIC_API_KEY: 'sk-ant-X',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        LOG_LEVEL: 'debug',
        SDD_GENERATOR_CACHE: '.sdd/cache',
        SDD_GENERATOR_TEMPLATES_DIR: 'src/templates',
      };

      // act
      const out = pickEnv(env);

      // assert
      expect(out.claudeProvider).toBe('cli');
      expect(out.anthropicApiKey).toBe('sk-ant-X');
      expect(out.logLevel).toBe('debug');
      expect(out.cacheDir).toBe('.sdd/cache');
    });

    it('returns undefined for absent keys', () => {
      // arrange
      const env = {};

      // act
      const out = pickEnv(env);

      // assert
      expect(out.claudeProvider).toBeUndefined();
      expect(out.anthropicApiKey).toBeUndefined();
    });
  });

  describe('resolveCwdRelative', () => {
    it('returns absolute paths unchanged', () => {
      // arrange
      const absolute = path.resolve('/tmp', 'foo');

      // act
      const out = resolveCwdRelative('/some/cwd', absolute);

      // assert
      expect(out).toBe(absolute);
    });

    it('resolves relative paths against the supplied cwd', () => {
      // arrange + act
      const out = resolveCwdRelative('/some/cwd', 'sub/file.txt');

      // assert
      expect(out).toBe(path.resolve('/some/cwd', 'sub/file.txt'));
    });
  });
});
