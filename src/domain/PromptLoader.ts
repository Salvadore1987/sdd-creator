import * as path from 'path';

import { FileNotFoundError } from '../ports/errors';
import type { IFileRepository } from '../ports/IFileRepository';

import type { RequirementTopic, Stack } from './models';

export class PromptLoader {
  public constructor(
    private readonly files: IFileRepository,
    private readonly templatesRoot: string,
  ) {}

  public async loadBrainstorm(stack: Stack, topic: RequirementTopic): Promise<string> {
    const stackPath = path.join(
      this.templatesRoot,
      'stacks',
      stack,
      'prompts',
      `brainstorm-${topic}.prompt`,
    );
    const basePath = path.join(this.templatesRoot, 'base', 'brainstorm', `${topic}.prompt`);
    return this.firstExisting([stackPath, basePath]);
  }

  private async firstExisting(candidates: readonly string[]): Promise<string> {
    for (const candidate of candidates) {
      try {
        return await this.files.read(candidate);
      } catch (error) {
        if (error instanceof FileNotFoundError) {
          continue;
        }
        throw error;
      }
    }
    throw new FileNotFoundError(candidates[candidates.length - 1] ?? '');
  }
}
