import { SCHEMA_VERSION } from './models';

export interface MigrationStep {
  readonly from: number;
  readonly to: number;
  run(doc: Record<string, unknown>): Record<string, unknown>;
}

export interface MigrationResult {
  readonly migrated: boolean;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly steps: readonly MigrationStep[];
  readonly document: Record<string, unknown>;
}

export class Migrator {
  public constructor(private readonly steps: readonly MigrationStep[] = []) {}

  public migrate(doc: Record<string, unknown>): MigrationResult {
    const current = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
    if (current === SCHEMA_VERSION) {
      return {
        migrated: false,
        fromVersion: current,
        toVersion: SCHEMA_VERSION,
        steps: [],
        document: doc,
      };
    }
    if (current > SCHEMA_VERSION) {
      throw new Error(
        `Document is at schema version ${String(current)} but this CLI supports only up to ${String(SCHEMA_VERSION)}.`,
      );
    }
    let working: Record<string, unknown> = { ...doc };
    const applied: MigrationStep[] = [];
    let cursor = current;
    while (cursor < SCHEMA_VERSION) {
      const step = this.steps.find((s) => s.from === cursor);
      if (step === undefined) {
        throw new Error(`No migration step registered from schema v${String(cursor)}.`);
      }
      working = step.run(working);
      working.schemaVersion = step.to;
      applied.push(step);
      cursor = step.to;
    }
    return {
      migrated: applied.length > 0,
      fromVersion: current,
      toVersion: SCHEMA_VERSION,
      steps: applied,
      document: working,
    };
  }
}
