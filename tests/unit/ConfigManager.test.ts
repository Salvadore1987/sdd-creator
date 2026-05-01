import { ConfigManager } from '../../src/domain/ConfigManager';
import { FileNotFoundError } from '../../src/ports/errors';
import type { IFileRepository } from '../../src/ports/IFileRepository';
import { makeProjectConfig } from '../fixtures/builders';

class InMemoryFileRepository implements IFileRepository {
  public readonly store = new Map<string, string>();

  public read(path: string): Promise<string> {
    const value = this.store.get(path);
    if (value === undefined) {
      return Promise.reject(new FileNotFoundError(path));
    }
    return Promise.resolve(value);
  }

  public async readJson<T>(path: string): Promise<T> {
    return JSON.parse(await this.read(path)) as T;
  }

  public write(path: string, content: string): Promise<void> {
    this.store.set(path, content);
    return Promise.resolve();
  }

  public async writeJson(path: string, value: unknown): Promise<void> {
    await this.write(path, JSON.stringify(value, null, 2));
  }

  public exists(path: string): Promise<boolean> {
    return Promise.resolve(this.store.has(path));
  }

  public mkdir(): Promise<void> {
    return Promise.resolve();
  }

  public remove(path: string): Promise<void> {
    this.store.delete(path);
    return Promise.resolve();
  }

  public list(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
}

describe('ConfigManager', () => {
  it('round-trips a valid config', async () => {
    // arrange
    const files = new InMemoryFileRepository();
    const manager = new ConfigManager(files, { cwd: '/proj', configPath: '/proj/.sdd/config.json' });
    const config = makeProjectConfig();

    // act
    await manager.save(config);
    const loaded = await manager.load();

    // assert
    expect(loaded).toEqual(config);
  });

  it('throws FileNotFoundError when config is missing', async () => {
    // arrange
    const files = new InMemoryFileRepository();
    const manager = new ConfigManager(files, { cwd: '/proj', configPath: '/proj/.sdd/config.json' });

    // act
    const promise = manager.load();

    // assert
    await expect(promise).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('rejects invalid stack when saving', async () => {
    // arrange
    const files = new InMemoryFileRepository();
    const manager = new ConfigManager(files, { cwd: '/proj', configPath: '/proj/.sdd/config.json' });
    const bad = { ...makeProjectConfig(), stack: 'cobol' as 'java' };

    // act
    const promise = manager.save(bad);

    // assert
    await expect(promise).rejects.toThrow();
  });

  it('builds initial config with timestamps and schemaVersion', () => {
    // arrange
    const files = new InMemoryFileRepository();
    const manager = new ConfigManager(files, { cwd: '/proj' });

    // act
    const built = manager.buildInitial({
      metadata: { name: 'demo' },
      stack: 'node',
      architecture: 'layered',
      language: 'en',
      technologies: ['express'],
      claude: { provider: 'cli' },
    });

    // assert
    expect(built.schemaVersion).toBe(1);
    expect(built.createdAt).toEqual(built.updatedAt);
    expect(built.metadata.name).toBe('demo');
  });
});
