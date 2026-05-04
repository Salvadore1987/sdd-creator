import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { generateIntegrationsSpec } from '../../src/commands/integrations.command';
import { ConfigManager } from '../../src/domain/ConfigManager';
import type { ILogger } from '../../src/ports/ILogger';
import { makeProjectConfig } from '../fixtures/builders';

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

describe('integrations spec --format (integration)', () => {
  let cwd: string;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-int-spec-fmt-'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const files = new FileRepository();
    const cfg = new ConfigManager(files, { cwd });
    await cfg.save(makeProjectConfig({ stack: 'java', architecture: 'hexagonal', language: 'en' }));
    await files.writeJson(path.join(cwd, '.sdd', 'integrations.json'), {
      schemaVersion: 1,
      integrations: [
        {
          id: 'INT-001',
          category: 'cache',
          name: 'Redis',
          purpose: 'cache',
          endpoints: [{ name: 'redis', protocol: 'redis', url: 'redis://r:6379' }],
          extra: { flavor: 'redis' },
        },
      ],
    });
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('confluence format returns a clear "not yet implemented" rejection', async () => {
    // arrange — confluence exporter is a stub, must surface its message
    const deps = {
      files: new FileRepository(),
      templateEngine: new HandlebarsTemplateEngine(),
      logger: new NoopLogger(),
      templatesRoot: TEMPLATES_ROOT,
    };

    // act
    const promise = generateIntegrationsSpec({ cwd, format: 'confluence' }, deps);

    // assert
    await expect(promise).rejects.toThrow(/not yet implemented/i);
  });

  it('without --format, writes only INTEGRATIONS.md', async () => {
    // arrange
    const deps = {
      files: new FileRepository(),
      templateEngine: new HandlebarsTemplateEngine(),
      logger: new NoopLogger(),
      templatesRoot: TEMPLATES_ROOT,
    };

    // act
    const result = await generateIntegrationsSpec({ cwd }, deps);

    // assert
    expect(result.outputPath.endsWith('INTEGRATIONS.md')).toBe(true);
    expect(result.exportPath).toBeUndefined();
    const md = await fs.readFile(result.outputPath, 'utf8');
    expect(md).toContain('INT-001');
    expect(md).toContain('Redis');
  });
});
