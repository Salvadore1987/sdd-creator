import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { FileNotFoundError } from '../../src/ports/errors';

describe('FileRepository (integration)', () => {
  let tempDir: string;
  let repo: FileRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-fr-'));
    repo = new FileRepository();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes and reads back text content', async () => {
    // arrange
    const file = path.join(tempDir, 'a.txt');

    // act
    await repo.write(file, 'hello');
    const value = await repo.read(file);

    // assert
    expect(value).toBe('hello');
  });

  it('creates parent directories on write', async () => {
    // arrange
    const file = path.join(tempDir, 'nested/deep/a.txt');

    // act
    await repo.write(file, 'x');

    // assert
    await expect(repo.exists(file)).resolves.toBe(true);
  });

  it('round-trips JSON', async () => {
    // arrange
    const file = path.join(tempDir, 'a.json');
    const payload = { hello: 'world', nested: { x: 1 } };

    // act
    await repo.writeJson(file, payload);
    const loaded = await repo.readJson<typeof payload>(file);

    // assert
    expect(loaded).toEqual(payload);
  });

  it('throws FileNotFoundError when reading missing file', async () => {
    // arrange
    const file = path.join(tempDir, 'missing.txt');

    // act
    const promise = repo.read(file);

    // assert
    await expect(promise).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('lists directory entries', async () => {
    // arrange
    await repo.write(path.join(tempDir, 'a.txt'), '1');
    await repo.write(path.join(tempDir, 'b.txt'), '2');

    // act
    const entries = await repo.list(tempDir);

    // assert
    expect([...entries].sort()).toEqual(['a.txt', 'b.txt']);
  });

  it('removes files', async () => {
    // arrange
    const file = path.join(tempDir, 'a.txt');
    await repo.write(file, 'x');

    // act
    await repo.remove(file);

    // assert
    await expect(repo.exists(file)).resolves.toBe(false);
  });
});
