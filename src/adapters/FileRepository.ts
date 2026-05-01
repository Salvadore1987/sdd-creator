import { promises as fs } from 'fs';
import * as path from 'path';

import { FileNotFoundError, PermissionError } from '../ports/errors';
import type { IFileRepository } from '../ports/IFileRepository';

interface NodeIoError {
  code?: string;
  message?: string;
}

function isNodeIoError(value: unknown): value is NodeIoError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NodeIoError).code === 'string'
  );
}

export class FileRepository implements IFileRepository {
  public async read(targetPath: string): Promise<string> {
    try {
      return await fs.readFile(targetPath, 'utf8');
    } catch (error) {
      throw this.translate(error, targetPath);
    }
  }

  public async readJson<T>(targetPath: string): Promise<T> {
    const content = await this.read(targetPath);
    return JSON.parse(content) as T;
  }

  public async write(targetPath: string, content: string): Promise<void> {
    await this.mkdir(path.dirname(targetPath));
    try {
      await fs.writeFile(targetPath, content, 'utf8');
    } catch (error) {
      throw this.translate(error, targetPath);
    }
  }

  public async writeJson(targetPath: string, value: unknown): Promise<void> {
    await this.write(targetPath, `${JSON.stringify(value, null, 2)}\n`);
  }

  public async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  public async mkdir(targetPath: string): Promise<void> {
    try {
      await fs.mkdir(targetPath, { recursive: true });
    } catch (error) {
      throw this.translate(error, targetPath);
    }
  }

  public async remove(targetPath: string): Promise<void> {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
    } catch (error) {
      throw this.translate(error, targetPath);
    }
  }

  public async list(targetPath: string): Promise<readonly string[]> {
    try {
      return await fs.readdir(targetPath);
    } catch (error) {
      throw this.translate(error, targetPath);
    }
  }

  private translate(error: unknown, targetPath: string): Error {
    if (!isNodeIoError(error)) {
      return error instanceof Error ? error : new Error(String(error));
    }
    if (error.code === 'ENOENT') {
      return new FileNotFoundError(targetPath);
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return new PermissionError(targetPath, error);
    }
    return error as Error;
  }
}
