import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runInit } from '../../src/commands/init.command';

describe('sdd init (e2e smoke)', () => {
  let tempDir: string;
  let configFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-init-e2e-'));
    configFile = path.join(tempDir, 'init.json');
    const payload = {
      metadata: { name: 'loan-service', description: 'demo' },
      stack: 'java',
      architecture: 'hexagonal',
      language: 'en',
      technologies: ['Spring Boot 3', 'PostgreSQL 16'],
      claudeProvider: 'cli',
    };
    await fs.writeFile(configFile, JSON.stringify(payload, null, 2));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('runs end-to-end with --non-interactive --config and writes the .sdd scaffold', async () => {
    // arrange
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // act
      const result = await runInit({
        cwd: tempDir,
        nonInteractive: true,
        configPath: configFile,
      });

      // assert
      expect(result.config.claude.provider).toBe('cli');
      expect(result.config.metadata.name).toBe('loan-service');
      const configOnDisk = JSON.parse(
        await fs.readFile(path.join(tempDir, '.sdd', 'config.json'), 'utf8'),
      );
      expect(configOnDisk.stack).toBe('java');
      expect(configOnDisk.architecture).toBe('hexagonal');
      const stack = await fs.readFile(path.join(tempDir, '.sdd', 'templates', 'stack.md'), 'utf8');
      expect(stack).toContain('loan-service');
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
