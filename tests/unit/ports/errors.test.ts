import { FileNotFoundError, PermissionError } from '../../../src/ports/errors';

describe('ports/errors', () => {
  describe('FileNotFoundError', () => {
    it('exposes the path that was not found and is recognisable via instanceof', () => {
      // arrange + act
      const err = new FileNotFoundError('/tmp/missing');

      // assert
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(FileNotFoundError);
      expect(err.name).toBe('FileNotFoundError');
      expect(err.path).toBe('/tmp/missing');
      expect(err.message).toContain('/tmp/missing');
    });
  });

  describe('PermissionError', () => {
    it('captures path and forwards the underlying cause', () => {
      // arrange
      const original = new Error('EACCES');

      // act
      const err = new PermissionError('/etc/secret', original);

      // assert
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PermissionError);
      expect(err.name).toBe('PermissionError');
      expect(err.path).toBe('/etc/secret');
      expect((err as { cause?: unknown }).cause).toBe(original);
      expect(err.message).toContain('/etc/secret');
    });

    it('omits cause when none is supplied', () => {
      // arrange + act
      const err = new PermissionError('/x');

      // assert
      expect((err as { cause?: unknown }).cause).toBeUndefined();
    });
  });
});
