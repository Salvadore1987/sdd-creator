import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { JiraJsonImporter } from '../../src/adapters/req-importers/JiraJsonImporter';
import { LinearJsonImporter } from '../../src/adapters/req-importers/LinearJsonImporter';
import { MarkdownRequirementImporter } from '../../src/adapters/req-importers/MarkdownRequirementImporter';

describe('Requirement importers', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-req-imp-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('MarkdownRequirementImporter parses ## FR-001 sections', async () => {
    // arrange
    const file = path.join(tempDir, 'features.md');
    await fs.writeFile(
      file,
      `# Backlog\n\n## FR-001 Submit application\n\nCustomer submits a loan application.\n\nPriority: must\n\n### Acceptance\n- Given an authenticated user When they submit Then a record is stored\n\n## FR-002 Cancel application\n\nLet user cancel.\n\nPriority: should\n\n### Acceptance\n- Given pending application When user cancels Then it is removed\n`,
    );
    const importer = new MarkdownRequirementImporter(new FileRepository());

    // act
    const drafts = await importer.import(file);

    // assert
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.title).toBe('Submit application');
    expect(drafts[0]?.priority).toBe('must');
    expect(drafts[0]?.acceptanceCriteria).toHaveLength(1);
    expect(drafts[0]?.acceptanceCriteria[0]?.given).toContain('authenticated');
    expect(drafts[1]?.priority).toBe('should');
  });

  it('JiraJsonImporter maps issues with priority + key tag', async () => {
    // arrange
    const file = path.join(tempDir, 'jira.json');
    await fs.writeFile(
      file,
      JSON.stringify({
        issues: [
          {
            key: 'PROJ-1',
            fields: {
              summary: 'Implement login',
              description: 'OAuth2 + MFA',
              priority: { name: 'High' },
            },
          },
          {
            key: 'PROJ-2',
            fields: {
              summary: 'Logout button',
              description: 'Trivial',
              priority: { name: 'Low' },
            },
          },
        ],
      }),
    );
    const importer = new JiraJsonImporter(new FileRepository());

    // act
    const drafts = await importer.import(file);

    // assert
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.title).toBe('Implement login');
    expect(drafts[0]?.priority).toBe('must');
    expect(drafts[0]?.tags).toEqual(['jira:PROJ-1']);
    expect(drafts[1]?.priority).toBe('could');
  });

  it('LinearJsonImporter maps numeric priority levels', async () => {
    // arrange
    const file = path.join(tempDir, 'linear.json');
    await fs.writeFile(
      file,
      JSON.stringify({
        issues: [
          { identifier: 'ENG-1', title: 'Critical fix', description: '', priority: 1 },
          { identifier: 'ENG-2', title: 'Nice-to-have', description: '', priority: 4 },
        ],
      }),
    );
    const importer = new LinearJsonImporter(new FileRepository());

    // act
    const drafts = await importer.import(file);

    // assert
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.priority).toBe('must');
    expect(drafts[1]?.priority).toBe('could');
    expect(drafts[1]?.tags).toEqual(['linear:ENG-2']);
  });
});
