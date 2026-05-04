import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { AsyncApiImporter } from '../../src/adapters/importers/AsyncApiImporter';
import { BpmnImporter } from '../../src/adapters/importers/BpmnImporter';
import { OpenApiImporter } from '../../src/adapters/importers/OpenApiImporter';

describe('Importers', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-imp-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('OpenApiImporter extracts servers and operations', async () => {
    // arrange
    const file = path.join(tempDir, 'spec.json');
    await fs.writeFile(
      file,
      JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Loan API', version: '1.0.0', description: 'Issue loans.' },
        servers: [{ url: 'https://api.loans.test/v1', description: 'prod' }],
        paths: {
          '/loans': {
            post: { summary: 'Create a loan' },
            get: { summary: 'List loans' },
          },
        },
      }),
    );
    const importer = new OpenApiImporter(new FileRepository());

    // act
    const result = await importer.import(file);

    // assert
    expect(result).toHaveLength(1);
    const integration = result[0]!;
    expect(integration.category).toBe('external-api');
    expect(integration.name).toBe('Loan API');
    expect(integration.endpoints[0]?.url).toBe('https://api.loans.test/v1');
    expect((integration.extra as { operations: string[] }).operations).toEqual([
      'POST /loans — Create a loan',
      'GET /loans — List loans',
    ]);
  });

  it('AsyncApiImporter extracts channels and protocol', async () => {
    // arrange
    const file = path.join(tempDir, 'spec.json');
    await fs.writeFile(
      file,
      JSON.stringify({
        asyncapi: '2.6.0',
        info: { title: 'Order events', version: '1.0.0' },
        servers: { prod: { url: 'kafka://broker:9092', protocol: 'kafka' } },
        channels: {
          'orders.placed': { subscribe: { operationId: 'fulfilment' } },
          'orders.cancelled': { subscribe: { operationId: 'fulfilment' } },
        },
      }),
    );
    const importer = new AsyncApiImporter(new FileRepository());

    // act
    const result = await importer.import(file);

    // assert
    expect(result).toHaveLength(1);
    const integration = result[0]!;
    expect(integration.category).toBe('message-broker');
    expect((integration.extra as { flavor: string }).flavor).toBe('kafka');
    expect((integration.extra as { topics: string[] }).topics).toEqual(['orders.placed', 'orders.cancelled']);
  });

  it('BpmnImporter extracts processes and tasks', async () => {
    // arrange
    const file = path.join(tempDir, 'flow.bpmn');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="loanOrigination" isExecutable="true">
    <bpmn:startEvent id="s1" name="Application received"/>
    <bpmn:userTask id="u1" name="Manual underwriting"/>
    <bpmn:serviceTask id="t1" name="Score applicant"/>
    <bpmn:endEvent id="e1" name="Application closed"/>
  </bpmn:process>
</bpmn:definitions>`;
    await fs.writeFile(file, xml);
    const importer = new BpmnImporter(new FileRepository());

    // act
    const result = await importer.import(file);

    // assert
    expect(result).toHaveLength(1);
    const integration = result[0]!;
    expect(integration.category).toBe('bpms');
    expect(integration.name).toBe('loanOrigination');
    expect((integration.extra as { processes: string[] }).processes).toEqual(['loanOrigination']);
    expect((integration.extra as { jobWorkers: string[] }).jobWorkers).toEqual(['Score applicant']);
    expect((integration.extra as { sagas: string[] }).sagas).toEqual(['Manual underwriting']);
  });
});
