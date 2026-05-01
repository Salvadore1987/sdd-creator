export interface IFileRepository {
  read(path: string): Promise<string>;
  readJson<T>(path: string): Promise<T>;
  write(path: string, content: string): Promise<void>;
  writeJson(path: string, value: unknown): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<readonly string[]>;
}
