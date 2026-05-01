import * as path from 'path';

import { FileNotFoundError } from '../ports/errors';
import type { IFileRepository } from '../ports/IFileRepository';
import { DEFAULTS } from '../utils/constants';
import { projectConfigSchema } from '../utils/validators';

import { SCHEMA_VERSION, type ProjectConfig } from './models';

export interface ConfigManagerOptions {
  readonly cwd: string;
  readonly configPath?: string;
}

export class ConfigManager {
  private readonly files: IFileRepository;
  private readonly cwd: string;
  private readonly configPath: string;

  public constructor(files: IFileRepository, options: ConfigManagerOptions) {
    this.files = files;
    this.cwd = options.cwd;
    this.configPath = options.configPath ?? path.join(options.cwd, DEFAULTS.configFile);
  }

  public async load(): Promise<ProjectConfig> {
    let raw: unknown;
    try {
      raw = await this.files.readJson<unknown>(this.configPath);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        throw new FileNotFoundError(this.configPath);
      }
      throw error;
    }
    return projectConfigSchema.parse(raw);
  }

  public async save(config: ProjectConfig): Promise<void> {
    const validated = projectConfigSchema.parse(config);
    await this.files.writeJson(this.configPath, validated);
  }

  public async exists(): Promise<boolean> {
    return this.files.exists(this.configPath);
  }

  public buildInitial(input: Omit<ProjectConfig, 'schemaVersion' | 'createdAt' | 'updatedAt'>): ProjectConfig {
    const now = new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
  }

  public touch(config: ProjectConfig): ProjectConfig {
    return { ...config, updatedAt: new Date().toISOString() };
  }

  public get path(): string {
    return this.configPath;
  }

  public get rootDir(): string {
    return this.cwd;
  }
}
