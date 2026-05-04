import { IntegrationCategoryRegistry } from '../../src/domain/IntegrationCategoryRegistry';

describe('IntegrationCategoryRegistry', () => {
  it('lists 13 known categories', () => {
    // arrange
    const registry = new IntegrationCategoryRegistry();

    // act
    const list = registry.list();

    // assert
    expect(list).toHaveLength(13);
    expect(new Set(list.map((d) => d.category))).toEqual(
      new Set([
        'bpms',
        'message-broker',
        'database',
        'cache',
        'search',
        'identity',
        'storage',
        'observability',
        'payment',
        'notification',
        'external-api',
        'legacy',
        'custom',
      ]),
    );
  });

  it('marks bpms / message-broker / database as having diagrams', () => {
    // arrange
    const registry = new IntegrationCategoryRegistry();

    // act
    const withDiagram = registry
      .list()
      .filter((d) => d.hasDiagram)
      .map((d) => d.category)
      .sort();

    // assert
    expect(withDiagram).toEqual(['bpms', 'database', 'message-broker']);
  });

  it('validates message-broker extras and rejects bad delivery enum', () => {
    // arrange
    const registry = new IntegrationCategoryRegistry();

    // act
    const ok = (): unknown =>
      registry.validateExtra('message-broker', { delivery: 'at-least-once', topics: ['t'] });
    const bad = (): unknown =>
      registry.validateExtra('message-broker', { delivery: 'maybe-once' });

    // assert
    expect(ok).not.toThrow();
    expect(bad).toThrow();
  });

  it('accepts arbitrary extras for "custom" category', () => {
    // arrange
    const registry = new IntegrationCategoryRegistry();

    // act
    const result = registry.validateExtra('custom', { whatever: 1, nested: { x: 'y' } });

    // assert
    expect(result).toEqual({ whatever: 1, nested: { x: 'y' } });
  });
});
