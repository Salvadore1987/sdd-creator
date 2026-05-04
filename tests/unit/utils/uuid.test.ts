import { newUuidV7 } from '../../../src/utils/uuid';

describe('utils/uuid', () => {
  it('produces a UUIDv7 string with the canonical 8-4-4-4-12 layout and version "7"', () => {
    // arrange + act
    const value = newUuidV7();

    // assert
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('produces unique values across successive calls', () => {
    // arrange + act
    const a = newUuidV7();
    const b = newUuidV7();

    // assert
    expect(a).not.toBe(b);
  });
});
