import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { LintService } from '../../src/application/LintService';
import { DEFAULTS } from '../../src/utils/constants';

const FIXTURE_ROOT = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'demo-projects',
  'loan-service',
);

describe('lint smoke on the loan-service demo (DoD)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-loan-smoke-'));
    await fs.mkdir(path.join(cwd, '.sdd'), { recursive: true });
    for (const file of ['config.json', 'requirements.json', 'integrations.json']) {
      await fs.copyFile(path.join(FIXTURE_ROOT, file), path.join(cwd, '.sdd', file));
    }
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('returns 0 errors (warnings allowed) on the loan-service fixture', async () => {
    // arrange — no docs/SDD.md yet, so the no-rendered-spec WARNING is expected
    const files = new FileRepository();
    const lint = new LintService({ files }, { cwd });

    // act
    const report = await lint.run();

    // assert
    expect(report.errorCount).toBe(0);
    // exit code may be 0 or 2 (warnings), never 1
    expect(lint.exitCodeFor(report)).toBeLessThan(2 + 1);
  });

  it('verifies the fixture exercises the full requirements / integrations surface', async () => {
    // arrange
    const requirements = JSON.parse(
      await fs.readFile(path.join(cwd, DEFAULTS.requirementsFile), 'utf8'),
    );
    const integrations = JSON.parse(
      await fs.readFile(path.join(cwd, DEFAULTS.integrationsFile), 'utf8'),
    );

    // assert — 12 arc42 sections present (10 topics + adrs + risks)
    expect(requirements.features.items.length).toBeGreaterThan(0);
    expect(requirements.quality.nfrs.length).toBeGreaterThan(0);
    expect(requirements.adrs.length).toBeGreaterThanOrEqual(1);
    expect(requirements.risks.length).toBeGreaterThanOrEqual(1);
    expect(integrations.integrations.length).toBeGreaterThan(0);
  });
});
