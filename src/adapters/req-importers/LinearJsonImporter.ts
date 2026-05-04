import type { Requirement } from '../../domain/models';
import type { IFileRepository } from '../../ports/IFileRepository';
import type {
  IRequirementImporter,
  RequirementImportFormat,
} from '../../ports/IRequirementImporter';

interface LinearIssue {
  readonly identifier?: string;
  readonly title?: string;
  readonly description?: string;
  readonly priority?: number;
}

interface LinearExport {
  readonly issues?: readonly LinearIssue[];
}

export class LinearJsonImporter implements IRequirementImporter {
  public readonly format: RequirementImportFormat = 'linear';

  public constructor(private readonly files: IFileRepository) {}

  public canImport(format: RequirementImportFormat): boolean {
    return format === 'linear';
  }

  public async import(filePath: string): Promise<ReadonlyArray<Omit<Requirement, 'id'>>> {
    const data = await this.files.readJson<LinearExport>(filePath);
    const issues = data.issues ?? [];
    return issues.map((issue) => ({
      title: issue.title ?? issue.identifier ?? 'Imported from Linear',
      description: issue.description ?? '',
      priority: this.mapPriority(issue.priority),
      acceptanceCriteria: [],
      ...(issue.identifier !== undefined ? { tags: [`linear:${issue.identifier}`] } : {}),
    }));
  }

  private mapPriority(p: number | undefined): Requirement['priority'] {
    switch (p) {
      case 1:
        return 'must';
      case 2:
        return 'must';
      case 3:
        return 'should';
      case 4:
        return 'could';
      default:
        return 'must';
    }
  }
}
