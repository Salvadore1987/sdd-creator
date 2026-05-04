import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { z } from 'zod';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { SpecService } from '../../src/application/SpecService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import { SCHEMA_VERSION } from '../../src/domain/models';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
import type { ILogger } from '../../src/ports/ILogger';
import { DEFAULTS } from '../../src/utils/constants';
import { makeProjectConfig, makeRequirementsDocument } from '../fixtures/builders';

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');

class CountingClaudeProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;
  public callCount = 0;

  public complete(_prompt: string, _opts?: ClaudeCompleteOptions): Promise<string> {
    this.callCount += 1;
    return Promise.resolve('NARRATIVE');
  }

  public completeJson<T>(_prompt: string, _schema: z.ZodType<T>): Promise<T> {
    throw new Error('not used');
  }
}

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

describe('SpecService --update', () => {
  it('reuses cached sections when inputs unchanged', async () => {
    // arrange
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-update-'));
    try {
      const files = new FileRepository();
      const configManager = new ConfigManager(files, { cwd });
      await configManager.save(makeProjectConfig({ stack: 'java', architecture: 'hexagonal' }));
      await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), makeRequirementsDocument());
      await files.writeJson(path.join(cwd, DEFAULTS.integrationsFile), {
        schemaVersion: SCHEMA_VERSION,
        integrations: [],
      });

      const claude = new CountingClaudeProvider();
      const service = new SpecService(
        {
          files,
          templateEngine: new HandlebarsTemplateEngine(),
          configManager,
          claude,
          logger: new NoopLogger(),
        },
        { cwd, templatesRoot: TEMPLATES_ROOT, diagramRetries: 0 },
      );

      // act — first run populates the cache
      await service.generate({ update: true });
      const callsAfterFirst = claude.callCount;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // act — second run reuses cache; no new Claude calls
      await service.generate({ update: true });

      // assert
      expect(claude.callCount).toBe(callsAfterFirst);

      // act — modify requirements; cache must be invalidated
      const requirements = makeRequirementsDocument({
        anti: { state: { status: 'completed' }, items: ['changed'] },
      });
      await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), requirements);
      await service.generate({ update: true });

      // assert — Claude was called again
      expect(claude.callCount).toBeGreaterThan(callsAfterFirst);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
