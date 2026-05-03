import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { PromptLoader } from '../../src/domain/PromptLoader';
import { FileNotFoundError } from '../../src/ports/errors';

describe('PromptLoader', () => {
  let tempDir: string;
  let loader: PromptLoader;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-loader-'));
    loader = new PromptLoader(new FileRepository(), tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('falls back to base/<topic>.prompt when stack-specific is missing', async () => {
    // arrange
    const baseDir = path.join(tempDir, 'base', 'brainstorm');
    await fs.mkdir(baseDir, { recursive: true });
    await fs.writeFile(path.join(baseDir, 'features.prompt'), 'BASE FEATURES');

    // act
    const out = await loader.loadBrainstorm('java', 'features');

    // assert
    expect(out).toBe('BASE FEATURES');
  });

  it('prefers stack-specific prompt when present', async () => {
    // arrange
    const baseDir = path.join(tempDir, 'base', 'brainstorm');
    await fs.mkdir(baseDir, { recursive: true });
    await fs.writeFile(path.join(baseDir, 'features.prompt'), 'BASE FEATURES');
    const stackDir = path.join(tempDir, 'stacks', 'java', 'prompts');
    await fs.mkdir(stackDir, { recursive: true });
    await fs.writeFile(path.join(stackDir, 'brainstorm-features.prompt'), 'JAVA FEATURES');

    // act
    const out = await loader.loadBrainstorm('java', 'features');

    // assert
    expect(out).toBe('JAVA FEATURES');
  });

  it('throws FileNotFoundError when neither exists', async () => {
    // arrange — empty templates root

    // act
    const promise = loader.loadBrainstorm('java', 'features');

    // assert
    await expect(promise).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
