import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { StatusService } from '../../src/application/StatusService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import { SCHEMA_VERSION } from '../../src/domain/models';
import { DEFAULTS } from '../../src/utils/constants';
import { makeProjectConfig, makeRequirementsDocument } from '../fixtures/builders';

describe('StatusService', () => {
  it('reports per-topic status with counts and next commands', async () => {
    // arrange
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-status-'));
    try {
      const files = new FileRepository();
      const configManager = new ConfigManager(files, { cwd });
      await configManager.save(makeProjectConfig());

      const requirements = makeRequirementsDocument({
        features: {
          state: { status: 'completed', updatedAt: '2026-05-04T00:00:00.000Z' },
          items: [
            {
              id: 'FR-001',
              title: 'A',
              description: 'b',
              priority: 'must',
              acceptanceCriteria: [],
            },
          ],
        },
        glossary: { state: { status: 'skipped', skippedAt: '2026-05-04T00:00:00.000Z' }, terms: [] },
      });
      await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), requirements);
      await files.writeJson(path.join(cwd, DEFAULTS.integrationsFile), {
        schemaVersion: SCHEMA_VERSION,
        integrations: [],
      });

      // act
      const report = await new StatusService({ files }, { cwd }).report();

      // assert
      const features = report.entries.find((e) => e.key === 'features');
      expect(features?.status).toBe('completed');
      expect(features?.count).toBe(1);
      const glossary = report.entries.find((e) => e.key === 'glossary');
      expect(glossary?.status).toBe('skipped');
      expect(glossary?.nextCommand).toBe('sdd add glossary');
      expect(report.summary.completed).toBeGreaterThan(0);
      expect(report.summary.skipped).toBeGreaterThanOrEqual(1);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
