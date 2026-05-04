import { Migrator } from '../../src/domain/Migrator';
import { SCHEMA_VERSION } from '../../src/domain/models';

describe('Migrator', () => {
  it('returns migrated=false when document is already at SCHEMA_VERSION', () => {
    // arrange
    const migrator = new Migrator();

    // act
    const result = migrator.migrate({ schemaVersion: SCHEMA_VERSION, payload: 1 });

    // assert
    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(SCHEMA_VERSION);
    expect(result.toVersion).toBe(SCHEMA_VERSION);
  });

  it('throws when the document is newer than the CLI', () => {
    // arrange
    const migrator = new Migrator();

    // act + assert
    expect(() => migrator.migrate({ schemaVersion: SCHEMA_VERSION + 5 })).toThrow(/supports only up to/);
  });

  it('applies registered migration steps in order', () => {
    // arrange
    const migrator = new Migrator([
      { from: 0, to: 1, run: (doc) => ({ ...doc, addedField: 'yes' }) },
    ]);

    // act
    const result = migrator.migrate({ schemaVersion: 0, payload: 'x' });

    // assert
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(1);
    expect(result.document.addedField).toBe('yes');
    expect(result.document.schemaVersion).toBe(1);
  });

  it('throws when a required step is missing', () => {
    // arrange
    const migrator = new Migrator();

    // act + assert
    expect(() => migrator.migrate({ schemaVersion: 0 })).toThrow(/No migration step/);
  });
});
