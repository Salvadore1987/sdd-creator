import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { z } from 'zod';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { SpecService } from '../../src/application/SpecService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import type { ProjectConfig } from '../../src/domain/models';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
import type { ILogger } from '../../src/ports/ILogger';
import { DEFAULTS } from '../../src/utils/constants';

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');
const FIXTURES_ROOT = path.resolve(__dirname, '..', 'fixtures', 'demo-projects');
const FROZEN_NOW = '2026-05-04T00:00:00.000Z';

class GoldenClaudeProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;

  public complete(prompt: string, _opts?: ClaudeCompleteOptions): Promise<string> {
    if (/sequenceDiagram/i.test(prompt)) {
      return Promise.resolve('sequenceDiagram\n  User->>Service: action\n  Service-->>User: ok');
    }
    if (/`?C4Container`?/.test(prompt)) {
      return Promise.resolve(
        'C4Container\n  Person(u, "User", "actor")\n  Container(api, "API", "stack")\n  Rel(u, api, "uses")',
      );
    }
    if (/`?C4Component`?/.test(prompt)) {
      return Promise.resolve('C4Component\n  Component(svc, "Service", "core")');
    }
    return Promise.resolve('NARRATIVE');
  }

  public completeJson<T>(_prompt: string, _schema: z.ZodType<T>): Promise<T> {
    throw new Error('completeJson not used in spec generation');
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

async function copyFixture(name: string, cwd: string): Promise<void> {
  const files = new FileRepository();
  const configRaw = await fs.readFile(path.join(FIXTURES_ROOT, name, 'config.json'), 'utf8');
  const requirementsRaw = await fs.readFile(path.join(FIXTURES_ROOT, name, 'requirements.json'), 'utf8');
  const integrationsRaw = await fs.readFile(path.join(FIXTURES_ROOT, name, 'integrations.json'), 'utf8');
  await files.writeJson(path.join(cwd, DEFAULTS.configFile), JSON.parse(configRaw) as ProjectConfig);
  await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), JSON.parse(requirementsRaw));
  await files.writeJson(path.join(cwd, DEFAULTS.integrationsFile), JSON.parse(integrationsRaw));
}

function buildService(cwd: string): SpecService {
  const files = new FileRepository();
  const configManager = new ConfigManager(files, { cwd });
  return new SpecService(
    {
      files,
      templateEngine: new HandlebarsTemplateEngine(),
      configManager,
      claude: new GoldenClaudeProvider(),
      logger: new NoopLogger(),
    },
    { cwd, templatesRoot: TEMPLATES_ROOT, diagramRetries: 0 },
  );
}

function freeze(markdown: string): string {
  return markdown
    .replace(/Generated: \d{4}-\d{2}-\d{2}T[^\n]*Z/g, `Generated: ${FROZEN_NOW}`)
    .replace(/\r\n/g, '\n');
}

describe.each(['loan-service', 'simple-cli-tool', 'event-platform'])(
  'SpecService golden — %s',
  (project) => {
    it('renders deterministic SDD matching snapshot', async () => {
      // arrange
      const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `sdd-golden-${project}-`));
      try {
        await copyFixture(project, cwd);
        const service = buildService(cwd);

        // act
        const result = await service.generate();

        // assert
        expect(freeze(result.markdown)).toMatchSnapshot();
      } finally {
        await fs.rm(cwd, { recursive: true, force: true });
      }
    });
  },
);
