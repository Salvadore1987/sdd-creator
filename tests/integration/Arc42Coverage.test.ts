import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { z } from 'zod';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { SpecService } from '../../src/application/SpecService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import type { ClaudeCompleteOptions, IClaudeProvider } from '../../src/ports/IClaudeProvider';
import type { ILogger } from '../../src/ports/ILogger';

const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'src', 'templates');
const FIXTURE_ROOT = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'demo-projects',
  'loan-service',
);

class StubClaudeProvider implements IClaudeProvider {
  public readonly kind = 'cli' as const;

  public complete(prompt: string, _opts?: ClaudeCompleteOptions): Promise<string> {
    void _opts;
    if (/sequenceDiagram/i.test(prompt)) {
      return Promise.resolve('sequenceDiagram\n  A->>B: x');
    }
    if (/C4Container/.test(prompt)) {
      return Promise.resolve('C4Container\n  Container(c, "C", "x")');
    }
    if (/C4Component/.test(prompt)) {
      return Promise.resolve('C4Component\n  Component(svc, "Service", "x")');
    }
    return Promise.resolve('Generated narrative covering the section.');
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

const ARC42_REQUIRED_SECTIONS: readonly string[] = [
  '## 1. Executive Summary',
  '## 3. Product Requirements',
  '## 4. Quality Attributes',
  '## 5. Glossary',
  '## 6. System Architecture',
  '## 7. Detailed Design',
  '## 8. Testing Strategy',
  '## 9. Deployment & Operations',
  '## 10. Implementation Plan',
  '## 11. Architecture Decision Records',
  '## 12. Risks Register',
  '## 14. Traceability',
];

describe('arc42 coverage smoke (DoD)', () => {
  it('the rendered SDD on the loan-service fixture contains all 12 arc42 anchor sections', async () => {
    // arrange
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-arc42-'));
    try {
      await fs.mkdir(path.join(cwd, '.sdd'), { recursive: true });
      for (const file of ['config.json', 'requirements.json', 'integrations.json']) {
        await fs.copyFile(path.join(FIXTURE_ROOT, file), path.join(cwd, '.sdd', file));
      }
      const files = new FileRepository();
      const configManager = new ConfigManager(files, { cwd });
      const service = new SpecService(
        {
          files,
          templateEngine: new HandlebarsTemplateEngine(),
          configManager,
          claude: new StubClaudeProvider(),
          logger: new NoopLogger(),
        },
        { cwd, templatesRoot: TEMPLATES_ROOT, diagramRetries: 0 },
      );

      // act
      const result = await service.generate();

      // assert
      for (const heading of ARC42_REQUIRED_SECTIONS) {
        expect(result.markdown).toContain(heading);
      }
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
