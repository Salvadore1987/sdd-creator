import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../../src/adapters/FileRepository';
import { FileNotFoundError } from '../../../src/ports/errors';
import type { IFileRepository } from '../../../src/ports/IFileRepository';

interface Harness {
  readonly repo: IFileRepository;
  readonly root: string;
  cleanup(): Promise<void>;
}

class InMemoryFileRepository implements IFileRepository {
  private readonly store = new Map<string, string>();
  private readonly dirs = new Set<string>(['/']);

  public read(filePath: string): Promise<string> {
    const value = this.store.get(filePath);
    if (value === undefined) {
      return Promise.reject(new FileNotFoundError(filePath));
    }
    return Promise.resolve(value);
  }

  public async readJson<T>(filePath: string): Promise<T> {
    const raw = await this.read(filePath);
    return JSON.parse(raw) as T;
  }

  public async write(filePath: string, content: string): Promise<void> {
    await this.mkdir(path.dirname(filePath));
    this.store.set(filePath, content);
  }

  public async writeJson(filePath: string, value: unknown): Promise<void> {
    await this.write(filePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  public exists(filePath: string): Promise<boolean> {
    return Promise.resolve(this.store.has(filePath) || this.dirs.has(filePath));
  }

  public mkdir(dirPath: string): Promise<void> {
    let cursor = '';
    for (const part of dirPath.split(path.sep)) {
      cursor = cursor === '' ? part || path.sep : path.join(cursor, part);
      this.dirs.add(cursor);
    }
    return Promise.resolve();
  }

  public remove(filePath: string): Promise<void> {
    this.store.delete(filePath);
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(`${filePath}${path.sep}`)) {
        this.store.delete(key);
      }
    }
    this.dirs.delete(filePath);
    return Promise.resolve();
  }

  public list(dirPath: string): Promise<readonly string[]> {
    if (!this.dirs.has(dirPath)) {
      return Promise.reject(new FileNotFoundError(dirPath));
    }
    const out = new Set<string>();
    const prefix = dirPath.endsWith(path.sep) ? dirPath : `${dirPath}${path.sep}`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const head = rest.split(path.sep)[0];
        if (head !== undefined && head !== '') {
          out.add(head);
        }
      }
    }
    return Promise.resolve([...out]);
  }
}

const cases: Array<{ name: string; create: () => Promise<Harness> }> = [
  {
    name: 'FileRepository (filesystem)',
    create: async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-contract-fs-'));
      return {
        repo: new FileRepository(),
        root,
        cleanup: () => fs.rm(root, { recursive: true, force: true }),
      };
    },
  },
  {
    name: 'InMemoryFileRepository',
    create: async () => {
      const root = path.join('/virtual', `contract-${Date.now()}`);
      const repo = new InMemoryFileRepository();
      await repo.mkdir(root);
      return {
        repo,
        root,
        cleanup: () => Promise.resolve(),
      };
    },
  },
];

describe.each(cases)('IFileRepository contract — $name', ({ create }) => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await create();
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  it('write+read round-trips text content', async () => {
    // arrange
    const file = path.join(harness.root, 'a.txt');

    // act
    await harness.repo.write(file, 'hello');
    const read = await harness.repo.read(file);

    // assert
    expect(read).toBe('hello');
  });

  it('writeJson + readJson round-trip preserves structural equality', async () => {
    // arrange
    const file = path.join(harness.root, 'nested', 'deep', 'a.json');
    const payload = { id: 'FR-001', tags: ['x', 'y'], nested: { count: 3 } };

    // act
    await harness.repo.writeJson(file, payload);
    const read = await harness.repo.readJson<typeof payload>(file);

    // assert
    expect(read).toEqual(payload);
  });

  it('exists returns false before write and true after', async () => {
    // arrange
    const file = path.join(harness.root, 'maybe.txt');

    // act
    const before = await harness.repo.exists(file);
    await harness.repo.write(file, 'x');
    const after = await harness.repo.exists(file);

    // assert
    expect(before).toBe(false);
    expect(after).toBe(true);
  });

  it('read throws FileNotFoundError on missing file', async () => {
    // arrange
    const file = path.join(harness.root, 'missing.txt');

    // act
    const promise = harness.repo.read(file);

    // assert
    await expect(promise).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('mkdir creates intermediate directories idempotently', async () => {
    // arrange
    const dir = path.join(harness.root, 'a', 'b', 'c');

    // act
    await harness.repo.mkdir(dir);
    await harness.repo.mkdir(dir); // second call must not throw

    // assert
    await expect(harness.repo.exists(dir)).resolves.toBe(true);
  });

  it('list returns the directory entries written so far', async () => {
    // arrange
    await harness.repo.write(path.join(harness.root, 'a.txt'), '1');
    await harness.repo.write(path.join(harness.root, 'b.txt'), '2');

    // act
    const entries = await harness.repo.list(harness.root);

    // assert
    expect([...entries].sort()).toEqual(['a.txt', 'b.txt']);
  });

  it('remove deletes a file and exists returns false', async () => {
    // arrange
    const file = path.join(harness.root, 'doomed.txt');
    await harness.repo.write(file, 'bye');

    // act
    await harness.repo.remove(file);

    // assert
    await expect(harness.repo.exists(file)).resolves.toBe(false);
  });
});
