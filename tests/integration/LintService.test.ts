import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { LintService } from '../../src/application/LintService';
import { SCHEMA_VERSION } from '../../src/domain/models';
import { DEFAULTS } from '../../src/utils/constants';
import { makeRequirementsDocument } from '../fixtures/builders';

describe('LintService', () => {
  let cwd: string;
  let files: FileRepository;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-lint-'));
    files = new FileRepository();
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('flags features without acceptance criteria as errors', async () => {
    // arrange
    const requirements = makeRequirementsDocument({
      features: {
        state: { status: 'completed' },
        items: [
          { id: 'FR-001', title: 'A', description: 'b', priority: 'must', acceptanceCriteria: [] },
        ],
      },
    });
    await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), requirements);
    const service = new LintService({ files }, { cwd });

    // act
    const report = await service.run();

    // assert
    expect(report.errorCount).toBeGreaterThanOrEqual(1);
    expect(report.findings.some((f) => f.rule === 'fr-without-ac')).toBe(true);
  });

  it('flags integrations without secretsRef as warnings', async () => {
    // arrange
    await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), makeRequirementsDocument());
    await files.writeJson(path.join(cwd, DEFAULTS.integrationsFile), {
      schemaVersion: SCHEMA_VERSION,
      integrations: [
        {
          id: 'INT-001',
          category: 'cache',
          name: 'Redis',
          purpose: 'cache',
          endpoints: [{ name: 'r', protocol: 'redis' }],
          auth: { mode: 'apikey' },
        },
      ],
    });
    const service = new LintService({ files }, { cwd });

    // act
    const report = await service.run();

    // assert
    expect(report.warningCount).toBeGreaterThanOrEqual(1);
    expect(
      report.findings.some((f) => f.rule === 'integration-missing-secrets-ref'),
    ).toBe(true);
  });

  it('flags invalid mermaid blocks in the rendered SDD', async () => {
    // arrange
    await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), makeRequirementsDocument());
    const sddPath = path.join(cwd, DEFAULTS.outputSddFile);
    await files.write(
      sddPath,
      '# Test\n\n```mermaid\nbogus diagram body\n```\n',
    );
    const service = new LintService({ files }, { cwd });

    // act
    const report = await service.run();

    // assert
    expect(report.findings.some((f) => f.rule === 'mermaid-invalid')).toBe(true);
  });

  it('promotes skipped sections to errors in --strict mode', async () => {
    // arrange
    const requirements = makeRequirementsDocument({
      glossary: { state: { status: 'skipped', skippedAt: '2026-05-04T00:00:00.000Z' }, terms: [] },
    });
    await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), requirements);
    const service = new LintService({ files }, { cwd });

    // act
    const lenient = await service.run();
    const strict = await service.run({ strict: true });

    // assert
    expect(lenient.findings.some((f) => f.severity === 'warning' && f.rule === 'section-skipped')).toBe(
      true,
    );
    expect(strict.findings.some((f) => f.severity === 'error' && f.rule === 'section-skipped')).toBe(true);
  });

  it('exit code is 0 (clean), 2 (warnings only), 1 (errors)', async () => {
    // arrange
    await files.writeJson(
      path.join(cwd, DEFAULTS.requirementsFile),
      makeRequirementsDocument(),
    );
    const service = new LintService({ files }, { cwd });

    // act
    const baseReport = await service.run();
    const exitWarn = service.exitCodeFor({ ...baseReport, errorCount: 0, warningCount: 1 });
    const exitErr = service.exitCodeFor({ ...baseReport, errorCount: 1, warningCount: 0 });
    const exitClean = service.exitCodeFor({ findings: [], errorCount: 0, warningCount: 0 });

    // assert
    expect(exitClean).toBe(0);
    expect(exitWarn).toBe(2);
    expect(exitErr).toBe(1);
  });
});
