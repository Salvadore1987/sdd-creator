import { RequirementsMerger } from '../../src/domain/RequirementsMerger';
import { makeRequirementsDocument, makeSectionState } from '../fixtures/builders';

describe('RequirementsMerger', () => {
  const completed = makeSectionState({ status: 'completed', updatedAt: '2026-05-01T00:00:00.000Z', inputsHash: 'h' });

  it('assigns SH-NNN ids to stakeholders', () => {
    // arrange
    const merger = new RequirementsMerger();
    const doc = makeRequirementsDocument();

    // act
    const next = merger.merge(
      doc,
      'stakeholders',
      {
        items: [
          { name: 'Alice', role: 'PO', responsibilities: ['scope'] },
          { name: 'Bob', role: 'SRE', responsibilities: ['oncall'], influence: 'high' },
        ],
      },
      { state: completed },
    );

    // assert
    expect(next.stakeholders.items.map((s) => s.id)).toEqual(['SH-001', 'SH-002']);
    expect(next.stakeholders.items[1]?.influence).toBe('high');
    expect(next.stakeholders.state.status).toBe('completed');
  });

  it('assigns FR-NNN to features and AC-FR-NNN-N to acceptance criteria', () => {
    // arrange
    const merger = new RequirementsMerger();
    const doc = makeRequirementsDocument();

    // act
    const next = merger.merge(
      doc,
      'features',
      {
        items: [
          {
            title: 'Login',
            description: 'User logs in',
            priority: 'must',
            acceptanceCriteria: [
              { given: 'valid creds', when: 'submit', then: 'session token issued' },
              { given: 'invalid creds', when: 'submit', then: '401 returned' },
            ],
          },
        ],
      },
      { state: completed },
    );

    // assert
    const feature = next.features.items[0]!;
    expect(feature.id).toBe('FR-001');
    expect(feature.acceptanceCriteria.map((ac) => ac.id)).toEqual(['AC-FR-001-1', 'AC-FR-001-2']);
  });

  it('continues numbering from existing FR ids', () => {
    // arrange
    const merger = new RequirementsMerger();
    const doc = makeRequirementsDocument({
      features: {
        state: completed,
        items: [
          {
            id: 'FR-007',
            title: 'existing',
            description: 'd',
            priority: 'should',
            acceptanceCriteria: [],
          },
        ],
      },
    });

    // act
    const next = merger.merge(
      doc,
      'features',
      {
        items: [
          {
            title: 'new',
            description: 'd',
            priority: 'must',
            acceptanceCriteria: [{ given: 'g', when: 'w', then: 't' }],
          },
        ],
      },
      { state: completed },
    );

    // assert
    expect(next.features.items.map((f) => f.id)).toEqual(['FR-007', 'FR-008']);
  });

  it('dedupes constraints, anti, compliance, dependencies', () => {
    // arrange
    const merger = new RequirementsMerger();
    const doc = makeRequirementsDocument({
      constraints: { state: completed, items: ['GDPR'] },
      anti: { state: completed, items: ['no PII export'] },
      compliance: { state: completed, items: ['SOC2'] },
      dependencies: { state: completed, integrationRefs: ['INT-001'] },
    });

    // act
    const constraintsNext = merger.merge(doc, 'constraints', { items: ['GDPR', 'PCI'] }, { state: completed });
    const antiNext = merger.merge(doc, 'anti', { items: ['no PII export', 'no SMS'] }, { state: completed });
    const complianceNext = merger.merge(doc, 'compliance', { items: ['SOC2', 'ISO27001'] }, { state: completed });
    const depsNext = merger.merge(doc, 'dependencies', { integrationRefs: ['INT-001', 'INT-002'] }, { state: completed });

    // assert
    expect(constraintsNext.constraints.items).toEqual(['GDPR', 'PCI']);
    expect(antiNext.anti.items).toEqual(['no PII export', 'no SMS']);
    expect(complianceNext.compliance.items).toEqual(['SOC2', 'ISO27001']);
    expect(depsNext.dependencies.integrationRefs).toEqual(['INT-001', 'INT-002']);
  });

  it('replaces context fields when provided', () => {
    // arrange
    const merger = new RequirementsMerger();
    const doc = makeRequirementsDocument({ context: { state: completed, statement: 'old' } });

    // act
    const next = merger.merge(
      doc,
      'context',
      { statement: 'new', goals: ['g1'], kpis: ['kpi1'] },
      { state: completed },
    );

    // assert
    expect(next.context.statement).toBe('new');
    expect(next.context.goals).toEqual(['g1']);
    expect(next.context.kpis).toEqual(['kpi1']);
  });

  it('skips glossary terms that already exist (case-insensitive)', () => {
    // arrange
    const merger = new RequirementsMerger();
    const doc = makeRequirementsDocument({
      glossary: { state: completed, terms: [{ term: 'Order', definition: 'd' }] },
    });

    // act
    const next = merger.merge(
      doc,
      'glossary',
      { terms: [{ term: 'order', definition: 'dup' }, { term: 'Customer', definition: 'd' }] },
      { state: completed },
    );

    // assert
    expect(next.glossary.terms.map((t) => t.term)).toEqual(['Order', 'Customer']);
  });
});
