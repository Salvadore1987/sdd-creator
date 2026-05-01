import type { Integration } from '../domain/models';

export type ImportFormat = 'openapi' | 'asyncapi' | 'bpmn';

export interface IIntegrationImporter {
  readonly format: ImportFormat;
  canImport(format: string): boolean;
  import(filePath: string): Promise<readonly Integration[]>;
}
