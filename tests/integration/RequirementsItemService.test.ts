import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { RequirementsItemService } from '../../src/application/RequirementsItemService';
import { DEFAULTS } from '../../src/utils/constants';
import { makeRequirementsDocument } from '../fixtures/builders';

describe('RequirementsItemService', () => {
  let cwd: string;
  let files: FileRepository;
  let service: RequirementsItemService;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-items-'));
    files = new FileRepository();
    await files.writeJson(path.join(cwd, DEFAULTS.requirementsFile), makeRequirementsDocument());
    service = new RequirementsItemService({ files }, { cwd });
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('appends a feature with FR-001 and AC-FR-001-N IDs', async () => {
    // act
    const created = await service.addFeature({
      title: 'Submit application',
      description: 'desc',
      priority: 'must',
      acceptanceCriteria: [
        { given: 'user', when: 'submits', then: 'persisted' },
        { given: 'user', when: 'fails validation', then: 'error returned' },
      ],
    });

    // assert
    expect(created.id).toBe('FR-001');
    expect(created.acceptanceCriteria.map((c) => c.id)).toEqual(['AC-FR-001-1', 'AC-FR-001-2']);

    const second = await service.addFeature({
      title: 'B',
      description: 'd',
      priority: 'should',
      acceptanceCriteria: [],
    });
    expect(second.id).toBe('FR-002');
  });

  it('appends an ADR with ADR-001 and increments', async () => {
    // act
    const adr1 = await service.addAdr({
      title: 'Use hexagonal',
      status: 'accepted',
      context: 'c',
      decision: 'd',
      consequences: 'k',
    });
    const adr2 = await service.addAdr({
      title: 'Use Zod',
      status: 'accepted',
      context: 'c',
      decision: 'd',
      consequences: 'k',
    });

    // assert
    expect(adr1.id).toBe('ADR-001');
    expect(adr2.id).toBe('ADR-002');
  });

  it('appends a risk with RISK-NNN', async () => {
    // act
    const risk = await service.addRisk({
      title: 'Outage',
      description: 'd',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'm',
    });

    // assert
    expect(risk.id).toBe('RISK-001');
  });
});
