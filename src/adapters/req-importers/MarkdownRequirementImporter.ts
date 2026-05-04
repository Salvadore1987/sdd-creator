import type { Requirement } from '../../domain/models';
import type { IFileRepository } from '../../ports/IFileRepository';
import type {
  IRequirementImporter,
  RequirementImportFormat,
} from '../../ports/IRequirementImporter';

const FEATURE_HEADING = /^##\s+(?:FR-\d{3,}|Feature[:\s])\s*(.+)$/i;

export class MarkdownRequirementImporter implements IRequirementImporter {
  public readonly format: RequirementImportFormat = 'md';

  public constructor(private readonly files: IFileRepository) {}

  public canImport(format: RequirementImportFormat): boolean {
    return format === 'md';
  }

  public async import(filePath: string): Promise<ReadonlyArray<Omit<Requirement, 'id'>>> {
    const raw = await this.files.read(filePath);
    return this.parse(raw);
  }

  public parse(markdown: string): ReadonlyArray<Omit<Requirement, 'id'>> {
    const lines = markdown.split(/\r?\n/);
    const features: Array<Omit<Requirement, 'id'>> = [];
    let current: { title: string; description: string[]; acceptance: string[]; priority: string } | null = null;

    const flush = (): void => {
      if (current === null) return;
      const ac = current.acceptance.map((line, idx) => this.parseAcceptance(line, idx + 1));
      features.push({
        title: current.title,
        description: current.description.join('\n').trim(),
        priority: this.normalizePriority(current.priority),
        acceptanceCriteria: ac,
      });
      current = null;
    };

    let inAcceptance = false;
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const headingMatch = FEATURE_HEADING.exec(line);
      if (headingMatch !== null && headingMatch[1] !== undefined) {
        flush();
        current = { title: headingMatch[1].trim(), description: [], acceptance: [], priority: 'must' };
        inAcceptance = false;
        continue;
      }
      if (current === null) continue;
      if (/^\s*Priority\s*[:|=]/i.test(line)) {
        current.priority = line.split(/[:=]/, 2)[1]?.trim() ?? 'must';
        continue;
      }
      if (/^###?\s*Acceptance/i.test(line)) {
        inAcceptance = true;
        continue;
      }
      if (/^##?\s+/.test(line)) {
        // next heading — only top-level boundaries flush; FEATURE_HEADING already handled above.
        flush();
        inAcceptance = false;
        continue;
      }
      if (inAcceptance && line.startsWith('-')) {
        current.acceptance.push(line.replace(/^-\s*/, ''));
      } else if (line !== '') {
        current.description.push(line);
      }
    }
    flush();

    return features;
  }

  private parseAcceptance(line: string, idx: number): { id: string; given: string; when: string; then: string } {
    const id = `AC-${idx}`;
    const gwt = /Given\s+(.+?)\s+When\s+(.+?)\s+Then\s+(.+)/i.exec(line);
    if (gwt !== null) {
      return { id, given: gwt[1] ?? '', when: gwt[2] ?? '', then: gwt[3] ?? '' };
    }
    return { id, given: '-', when: '-', then: line };
  }

  private normalizePriority(raw: string): Requirement['priority'] {
    const normalized = raw.toLowerCase();
    if (normalized.startsWith('must')) return 'must';
    if (normalized.startsWith('should')) return 'should';
    if (normalized.startsWith('could')) return 'could';
    if (normalized.startsWith('wont') || normalized.startsWith("won't")) return 'wont';
    return 'must';
  }
}
