import { CompletenessLinter } from '../../src/domain/CompletenessLinter';
import { makeIntegration, makeRequirementsDocument } from '../fixtures/builders';

describe('CompletenessLinter', () => {
  it('emits an error for FR without acceptance criteria', () => {
    // arrange
    const linter = new CompletenessLinter();
    const doc = makeRequirementsDocument({
      features: {
        state: { status: 'completed' },
        items: [
          {
            id: 'FR-001',
            title: 't',
            description: 'd',
            priority: 'must',
            acceptanceCriteria: [],
          },
        ],
      },
    });

    // act
    const report = linter.lint({ requirements: doc, integrations: [] });

    // assert
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.rule).toBe('fr-without-ac');
  });

  it('warns when integration auth has no secretsRef', () => {
    // arrange
    const linter = new CompletenessLinter();
    const integration = makeIntegration({ auth: { mode: 'oauth2' } });

    // act
    const report = linter.lint({
      requirements: makeRequirementsDocument(),
      integrations: [integration],
    });

    // assert
    expect(report.warningCount).toBeGreaterThanOrEqual(1);
    expect(
      report.findings.some((f) => f.rule === 'integration-missing-secrets-ref'),
    ).toBe(true);
  });

  it('promotes skipped sections to error in strict mode', () => {
    // arrange
    const linter = new CompletenessLinter();
    const doc = makeRequirementsDocument({
      stakeholders: { state: { status: 'skipped' }, items: [] },
    });

    // act
    const lenient = linter.lint({ requirements: doc, integrations: [] });
    const strict = linter.lint({ requirements: doc, integrations: [], strict: true });

    // assert
    expect(lenient.warningCount).toBeGreaterThanOrEqual(1);
    expect(strict.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('flags references to unknown integrations', () => {
    // arrange
    const linter = new CompletenessLinter();
    const doc = makeRequirementsDocument({
      features: {
        state: { status: 'completed' },
        items: [
          {
            id: 'FR-001',
            title: 't',
            description: 'd',
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
    const report = linter.lint({ requirements: doc, integrations: [] });

    // assert
    expect(report.findings.some((f) => f.rule === 'unresolved-reference')).toBe(true);
  });
});
