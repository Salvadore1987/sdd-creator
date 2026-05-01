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
});
