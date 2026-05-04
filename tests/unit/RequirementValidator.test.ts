import { RequirementValidator } from '../../src/domain/RequirementValidator';
import { makeRequirementsDocument } from '../fixtures/builders';

describe('RequirementValidator', () => {
  it('validates a minimal requirement document', () => {
    // arrange
    const validator = new RequirementValidator();
    const doc = makeRequirementsDocument();

    // act
    const result = validator.validateDocument(doc);

    // assert
    expect(result.schemaVersion).toBe(1);
  });

  it('flags references to unknown integrations', () => {
    // arrange
    const validator = new RequirementValidator();
    const doc = makeRequirementsDocument({
      features: {
        state: { status: 'completed' },
        items: [
          {
            id: 'FR-001',
            title: 'Feature with bad ref',
            description: 'desc',
            priority: 'must',
            usesIntegrations: ['INT-999'],
            acceptanceCriteria: [
              { id: 'AC-FR-001-1', given: 'g', when: 'w', then: 't' },
            ],
          },
        ],
      },
    });

    // act
    const issues = validator.checkReferentialIntegrity(doc, new Set(['INT-001']));

    // assert
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/INT-999/);
  });

  it('flags AC IDs that do not match the parent FR', () => {
    // arrange
    const validator = new RequirementValidator();
    const doc = makeRequirementsDocument({
      features: {
        state: { status: 'completed' },
        items: [
          {
            id: 'FR-001',
            title: 'F',
            description: 'd',
            priority: 'must',
            acceptanceCriteria: [
              { id: 'AC-FR-002-1', given: 'g', when: 'w', then: 't' },
            ],
          },
        ],
      },
    });

    // act
    const issues = validator.checkReferentialIntegrity(doc, new Set());

    // assert
    expect(issues.some((i) => i.message.includes('does not match parent'))).toBe(true);
  });

  it('rejects malformed stable IDs', () => {
    // arrange
    const validator = new RequirementValidator();

    // act
    const fn = (): unknown =>
      validator.validateRequirement({
        id: 'badId',
        title: 't',
        description: 'd',
        priority: 'must',
        acceptanceCriteria: [],
      });

    // assert
    expect(fn).toThrow();
  });

  it('flags unknown dependencies.integrationRefs', () => {
    // arrange
    const validator = new RequirementValidator();
    const doc = makeRequirementsDocument({
      dependencies: {
        state: { status: 'completed' },
        integrationRefs: ['INT-999'],
      },
    });

    // act
    const issues = validator.checkReferentialIntegrity(doc, new Set(['INT-001']));

    // assert
    expect(issues.some((i) => i.path === 'dependencies.integrationRefs')).toBe(true);
  });

  it('flags ADR.relatedRequirements pointing to unknown FR ids', () => {
    // arrange
    const validator = new RequirementValidator();
    const doc = makeRequirementsDocument({
      adrs: [
        {
          id: 'ADR-001',
          title: 't',
          status: 'accepted',
          context: 'c',
          decision: 'd',
          consequences: 'cs',
          relatedRequirements: ['FR-404'],
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    // act
    const issues = validator.checkReferentialIntegrity(doc, new Set());

    // assert
    expect(issues.some((i) => i.message.includes('FR-404'))).toBe(true);
  });

  it('individual schema validators accept valid items and reject malformed ones', () => {
    // arrange
    const validator = new RequirementValidator();
    const validNfr = {
      id: 'NFR-001',
      category: 'performance' as const,
      statement: 'Be fast',
      measurableTarget: 'p95 < 200ms',
    };
    const validAdr = {
      id: 'ADR-001',
      title: 't',
      status: 'accepted' as const,
      context: 'c',
      decision: 'd',
      consequences: 'cs',
      createdAt: '2026-05-01T00:00:00.000Z',
    };
    const validRisk = {
      id: 'RISK-001',
      title: 't',
      description: 'd',
      likelihood: 'medium' as const,
      impact: 'high' as const,
      mitigation: 'm',
      owner: 'platform',
    };
    const validStakeholder = {
      id: 'SH-001',
      name: 'Alice',
      role: 'PO',
      responsibilities: ['scope'],
    };
    const validAc = { id: 'AC-FR-001-1', given: 'g', when: 'w', then: 't' };
    const validTerm = { term: 'Loan', definition: 'monetary advance' };

    // act + assert — happy paths
    expect(validator.validateNfr(validNfr).id).toBe('NFR-001');
    expect(validator.validateAdr(validAdr).id).toBe('ADR-001');
    expect(validator.validateRisk(validRisk).id).toBe('RISK-001');
    expect(validator.validateStakeholder(validStakeholder).id).toBe('SH-001');
    expect(validator.validateAcceptanceCriterion(validAc).id).toBe('AC-FR-001-1');
    expect(validator.validateGlossaryTerm(validTerm).term).toBe('Loan');

    // act + assert — error paths (malformed IDs)
    expect(() => validator.validateNfr({ ...validNfr, id: 'NFR-bad' })).toThrow();
    expect(() => validator.validateAdr({ ...validAdr, id: 'X' })).toThrow();
    expect(() => validator.validateRisk({ ...validRisk, id: 'r' })).toThrow();
    expect(() => validator.validateStakeholder({ ...validStakeholder, id: 'foo' })).toThrow();
    expect(() => validator.validateAcceptanceCriterion({ ...validAc, id: 'BAD' })).toThrow();
    expect(() => validator.validateGlossaryTerm({ term: '', definition: 'x' })).toThrow();
  });
});
