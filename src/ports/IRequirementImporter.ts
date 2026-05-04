import type { Requirement } from '../domain/models';

export type RequirementImportFormat = 'md' | 'jira' | 'linear';

export interface IRequirementImporter {
  readonly format: RequirementImportFormat;
  canImport(format: RequirementImportFormat): boolean;
  import(filePath: string): Promise<ReadonlyArray<Omit<Requirement, 'id'>>>;
}
