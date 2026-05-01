import type { IdPrefix } from './models';

export class IdGenerator {
  public next(prefix: IdPrefix, existing: readonly string[]): string {
    const max = this.maxOrdinal(prefix, existing);
    return this.format(prefix, max + 1);
  }

  public childOf(parentId: string, existing: readonly string[]): string {
    const taken = existing
      .map((id) => this.parseChildOrdinal(parentId, id))
      .filter((value): value is number => value !== null);
    const next = (taken.length === 0 ? 0 : Math.max(...taken)) + 1;
    return `AC-${parentId}-${String(next)}`;
  }

  public format(prefix: IdPrefix, ordinal: number): string {
    if (!Number.isInteger(ordinal) || ordinal <= 0) {
      throw new Error(`Ordinal must be a positive integer, got ${String(ordinal)}`);
    }
    return `${prefix}-${ordinal.toString().padStart(3, '0')}`;
  }

  public parse(id: string): { prefix: string; ordinal: number } | null {
    const match = /^([A-Z]+)-(\d+)$/.exec(id);
    if (!match || match[1] === undefined || match[2] === undefined) {
      return null;
    }
    return { prefix: match[1], ordinal: Number.parseInt(match[2], 10) };
  }

  private maxOrdinal(prefix: IdPrefix, existing: readonly string[]): number {
    let max = 0;
    for (const id of existing) {
      const parsed = this.parse(id);
      if (parsed && parsed.prefix === prefix && parsed.ordinal > max) {
        max = parsed.ordinal;
      }
    }
    return max;
  }

  private parseChildOrdinal(parentId: string, id: string): number | null {
    const expected = `AC-${parentId}-`;
    if (!id.startsWith(expected)) {
      return null;
    }
    const tail = id.slice(expected.length);
    const ordinal = Number.parseInt(tail, 10);
    return Number.isFinite(ordinal) && ordinal > 0 ? ordinal : null;
  }
}
