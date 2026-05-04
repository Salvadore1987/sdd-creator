import { MermaidDiagramBuilder } from '../../src/domain/MermaidDiagramBuilder';
import { MermaidValidator } from '../../src/domain/MermaidValidator';
import { makeIntegration, makeProjectConfig } from '../fixtures/builders';

describe('MermaidDiagramBuilder', () => {
  const validator = new MermaidValidator();

  it('produces a valid C4Context with one external system per integration', () => {
    // arrange
    const builder = new MermaidDiagramBuilder();
    const config = makeProjectConfig({ metadata: { name: 'loan-service' } });
    const integrations = [
      makeIntegration({ id: 'INT-001', name: 'RabbitMQ', category: 'message-broker' }),
      makeIntegration({ id: 'INT-002', name: 'Postgres', category: 'database' }),
    ];

    // act
    const diagram = builder.c4Context(config, integrations);

    // assert
    expect(diagram.startsWith('C4Context')).toBe(true);
    expect(diagram).toContain('System_Ext(INT_001');
    expect(diagram).toContain('System_Ext(INT_002');
    expect(validator.validate(diagram).valid).toBe(true);
  });

  it('produces a valid class diagram from aggregates', () => {
    // arrange
    const builder = new MermaidDiagramBuilder();

    // act
    const diagram = builder.domainClass([
      {
        name: 'LoanApplication',
        boundedContext: 'Origination',
        description: 'desc',
        entities: ['Application', 'Applicant'],
        valueObjects: ['Amount'],
        events: ['ApplicationSubmitted'],
      },
    ]);

    // assert
    expect(diagram.startsWith('classDiagram')).toBe(true);
    expect(diagram).toContain('class LoanApplication');
    expect(diagram).toContain('emits');
    expect(validator.validate(diagram).valid).toBe(true);
  });

  it('produces a valid broker topology', () => {
    // arrange
    const builder = new MermaidDiagramBuilder();
    const integrations = [
      makeIntegration({
        id: 'INT-001',
        category: 'message-broker',
        name: 'Kafka',
        extra: { topics: ['orders.placed', 'orders.cancelled'] },
      }),
    ];

    // act
    const diagram = builder.brokerTopology(integrations);

    // assert
    expect(diagram.startsWith('flowchart')).toBe(true);
    expect(diagram).toContain('orders.placed');
    expect(validator.validate(diagram).valid).toBe(true);
  });

  it('produces a valid BPMN flow with processes / service tasks / user tasks', () => {
    // arrange
    const builder = new MermaidDiagramBuilder();
    const integrations = [
      makeIntegration({
        id: 'INT-009',
        category: 'bpms',
        name: 'Camunda',
        extra: {
          processes: ['loanOrigination'],
          jobWorkers: ['Score applicant'],
          sagas: ['Manual underwriting'],
        },
      }),
    ];

    // act
    const diagram = builder.bpmnFlow(integrations);

    // assert
    expect(diagram.startsWith('flowchart')).toBe(true);
    expect(diagram).toContain('loanOrigination');
    expect(diagram).toContain('Score applicant');
    expect(diagram).toContain('Manual underwriting');
    expect(validator.validate(diagram).valid).toBe(true);
  });

  it('emits a deterministic default sequence diagram from a feature', () => {
    // arrange
    const builder = new MermaidDiagramBuilder();
    const feature = {
      id: 'FR-001',
      title: 'Submit application',
      description: 'd',
      priority: 'must' as const,
      acceptanceCriteria: [],
      usesIntegrations: ['INT-001'],
    };
    const integrations = [makeIntegration({ id: 'INT-001', name: 'Bureau' })];

    // act
    const diagram = builder.defaultSequence(feature, integrations);

    // assert
    expect(diagram.startsWith('sequenceDiagram')).toBe(true);
    expect(diagram).toContain('Submit application');
    expect(validator.validate(diagram).valid).toBe(true);
  });
});
