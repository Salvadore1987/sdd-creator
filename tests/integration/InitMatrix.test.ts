import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { InitService, type InitInput } from '../../src/application/InitService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import type { Architecture, Stack } from '../../src/domain/models';
import type { IClaudeCliProbe } from '../../src/ports/IClaudeCliProbe';
import type { ILogger } from '../../src/ports/ILogger';

const STACKS: readonly Stack[] = ['java', 'node', 'python', 'go', 'rust'];
const ARCHITECTURES: readonly Architecture[] = [
  'hexagonal',
  'layered',
  'microservices',
  'event-driven',
  'monolith',
];

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

class FakeProbe implements IClaudeCliProbe {
  public probe(): Promise<{ installed: boolean; authenticated: boolean; version: string }> {
    return Promise.resolve({ installed: true, authenticated: true, version: 'stub' });
  }
}

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');

const matrix: Array<{ stack: Stack; architecture: Architecture }> = [];
for (const stack of STACKS) {
  for (const architecture of ARCHITECTURES) {
    matrix.push({ stack, architecture });
  }
}

describe('init matrix — every stack × architecture renders cleanly', () => {
  it.each(matrix)(
    'stack=$stack × architecture=$architecture produces non-empty templates',
    async ({ stack, architecture }) => {
      // arrange
      const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `sdd-matrix-${stack}-${architecture}-`));
      try {
        const files = new FileRepository();
        const configManager = new ConfigManager(files, { cwd });
        const service = new InitService(
          {
            files,
            configManager,
            templateEngine: new HandlebarsTemplateEngine(),
            logger: new NoopLogger(),
            cliProbe: new FakeProbe(),
          },
          { cwd, templatesRoot: TEMPLATES_ROOT },
        );
        const input: InitInput = {
          metadata: { name: `${stack}-${architecture}-demo` },
          stack,
          architecture,
          language: 'en',
          technologies: [],
          claudeProvider: 'cli',
        };

        // act
        const result = await service.execute(input);

        // assert
        const stackOnDisk = await fs.readFile(result.stackTemplatePath, 'utf8');
        const archOnDisk = await fs.readFile(result.architectureTemplatePath, 'utf8');
        expect(stackOnDisk.length).toBeGreaterThan(50);
        expect(archOnDisk.length).toBeGreaterThan(50);
        expect(stackOnDisk).toContain(`${stack}-${architecture}-demo`);
      } finally {
        await fs.rm(cwd, { recursive: true, force: true });
      }
    },
  );
});
