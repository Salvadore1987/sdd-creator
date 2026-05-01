import { IdGenerator } from '../../src/domain/IdGenerator';
import { ID_PREFIXES } from '../../src/domain/models';

describe('IdGenerator', () => {
  it('returns FR-001 when no existing IDs', () => {
    // arrange
    const gen = new IdGenerator();

    // act
    const id = gen.next(ID_PREFIXES.feature, []);

    // assert
    expect(id).toBe('FR-001');
  });

  it('increments past the highest existing ordinal for the same prefix', () => {
    // arrange
    const gen = new IdGenerator();
    const existing = ['FR-001', 'FR-007', 'NFR-099'];

    // act
    const id = gen.next(ID_PREFIXES.feature, existing);

    // assert
    expect(id).toBe('FR-008');
  });

  it('ignores foreign prefixes when computing next', () => {
    // arrange
    const gen = new IdGenerator();
    const existing = ['NFR-050', 'ADR-200'];

    // act
    const id = gen.next(ID_PREFIXES.feature, existing);

    // assert
    expect(id).toBe('FR-001');
  });

  it('formats child AC IDs scoped to parent feature', () => {
    // arrange
    const gen = new IdGenerator();
    const existing = ['AC-FR-001-1', 'AC-FR-001-2'];

    // act
    const id = gen.childOf('FR-001', existing);

    // assert
    expect(id).toBe('AC-FR-001-3');
  });

  it('parses well-formed IDs', () => {
    // arrange
    const gen = new IdGenerator();

    // act
    const parsed = gen.parse('FR-042');

    // assert
    expect(parsed).toEqual({ prefix: 'FR', ordinal: 42 });
  });

  it('returns null for malformed IDs', () => {
    // arrange
    const gen = new IdGenerator();

    // act
    const parsed = gen.parse('not-an-id');

    // assert
    expect(parsed).toBeNull();
  });
});
