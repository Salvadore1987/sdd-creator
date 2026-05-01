import type { RequirementTopic, SectionState } from '../../src/domain/models';
import { StatusTracker, TOPIC_DEPENDENCIES } from '../../src/domain/StatusTracker';

describe('StatusTracker', () => {
  it('marks a section completed with timestamp and inputsHash', () => {
    // arrange
    const tracker = new StatusTracker();

    // act
    const state = tracker.markCompleted({ inputsHash: 'h1', now: '2026-05-01T00:00:00.000Z' });

    // assert
    expect(state).toEqual({
      status: 'completed',
      updatedAt: '2026-05-01T00:00:00.000Z',
      inputsHash: 'h1',
    });
  });

  it('marks completed dependents stale when source topic changes', () => {
    // arrange
    const tracker = new StatusTracker();
    const baseDone: SectionState = {
      status: 'completed',
      updatedAt: '2026-05-01T00:00:00.000Z',
      inputsHash: 'h',
    };
    const sections = {
      stakeholders: { status: 'completed' } as SectionState,
      context: baseDone,
      constraints: baseDone,
      glossary: baseDone,
      features: baseDone,
      domain: baseDone,
      quality: baseDone,
      dependencies: baseDone,
      anti: baseDone,
      compliance: baseDone,
    } satisfies Record<RequirementTopic, SectionState>;

    // act
    const next = tracker.propagateStaleness(sections, 'features');

    // assert
    expect(TOPIC_DEPENDENCIES.domain).toContain('features');
    expect(next.domain.status).toBe('stale');
    expect(next.quality.status).toBe('stale');
    expect(next.dependencies.status).toBe('stale');
  });

  it('does not flip skipped sections to stale', () => {
    // arrange
    const tracker = new StatusTracker();
    const skipped: SectionState = { status: 'skipped' };

    // act
    const next = tracker.markStale(skipped);

    // assert
    expect(next).toEqual(skipped);
  });

  it('hashes inputs deterministically', () => {
    // arrange
    const tracker = new StatusTracker();

    // act
    const a = tracker.hashInputs({ x: 1 });
    const b = tracker.hashInputs({ x: 1 });

    // assert
    expect(a).toEqual(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
