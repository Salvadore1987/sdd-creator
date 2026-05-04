import type { Requirement } from '../../domain/models';
import type { IFileRepository } from '../../ports/IFileRepository';
import type {
  IRequirementImporter,
  RequirementImportFormat,
} from '../../ports/IRequirementImporter';

interface JiraIssue {
  readonly key?: string;
  readonly fields?: {
    readonly summary?: string;
    readonly description?: string;
    readonly priority?: { readonly name?: string };
    readonly customfield_10000?: string;
  };
}

interface JiraExport {
  readonly issues?: readonly JiraIssue[];
}

export class JiraJsonImporter implements IRequirementImporter {
  public readonly format: RequirementImportFormat = 'jira';

  public constructor(private readonly files: IFileRepository) {}

  public canImport(format: RequirementImportFormat): boolean {
    return format === 'jira';
  }

  public async import(filePath: string): Promise<ReadonlyArray<Omit<Requirement, 'id'>>> {
    const data = await this.files.readJson<JiraExport>(filePath);
    const issues = data.issues ?? [];
    return issues.map((issue) => this.toRequirement(issue));
  }

  private toRequirement(issue: JiraIssue): Omit<Requirement, 'id'> {
    const summary = issue.fields?.summary ?? issue.key ?? 'Imported from Jira';
    const description = issue.fields?.description ?? '';
    const priority = this.mapPriority(issue.fields?.priority?.name);
    return {
      title: summary,
      description,
      priority,
      acceptanceCriteria: [],
      ...(issue.key !== undefined ? { tags: [`jira:${issue.key}`] } : {}),
    };
  }

  private mapPriority(value: string | undefined): Requirement['priority'] {
    if (value === undefined) return 'must';
    const normalized = value.toLowerCase();
    if (normalized.includes('high') || normalized.includes('blocker') || normalized.includes('critical')) return 'must';
    if (normalized.includes('medium') || normalized.includes('major')) return 'should';
    if (normalized.includes('low') || normalized.includes('minor')) return 'could';
    if (normalized.includes("won't")) return 'wont';
    return 'must';
  }
}
