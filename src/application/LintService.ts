import * as path from 'path';

import { CompletenessLinter, type LintFinding, type LintReport } from '../domain/CompletenessLinter';
import { MermaidValidator } from '../domain/MermaidValidator';
import type {
  Integration,
  IntegrationsDocument,
  RequirementsDocument,
} from '../domain/models';
import { FileNotFoundError } from '../ports/errors';
import type { IFileRepository } from '../ports/IFileRepository';
import { DEFAULTS } from '../utils/constants';
import { integrationsDocumentSchema, requirementsDocumentSchema } from '../utils/validators';

export interface LintServiceDeps {
  readonly files: IFileRepository;
  readonly linter?: CompletenessLinter;
  readonly mermaidValidator?: MermaidValidator;
}

export interface LintServiceOptions {
  readonly cwd: string;
}

export interface LintRunOptions {
  readonly strict?: boolean;
  readonly sddPath?: string;
}

export class LintService {
  private readonly files: IFileRepository;
  private readonly linter: CompletenessLinter;
  private readonly mermaid: MermaidValidator;
  private readonly cwd: string;

  public constructor(deps: LintServiceDeps, options: LintServiceOptions) {
    this.files = deps.files;
    this.linter = deps.linter ?? new CompletenessLinter();
    this.mermaid = deps.mermaidValidator ?? new MermaidValidator();
    this.cwd = options.cwd;
  }

  public async run(options: LintRunOptions = {}): Promise<LintReport> {
    const requirements = await this.loadRequirements();
    const integrations = await this.loadIntegrations();
    const baseReport = this.linter.lint({
      requirements,
      integrations,
      ...(options.strict !== undefined ? { strict: options.strict } : {}),
    });

    const mermaidFindings = await this.checkMermaid(options.sddPath);
    const allFindings: LintFinding[] = [...baseReport.findings, ...mermaidFindings];
    return {
      findings: allFindings,
      errorCount: allFindings.filter((f) => f.severity === 'error').length,
      warningCount: allFindings.filter((f) => f.severity === 'warning').length,
    };
  }

  public exitCodeFor(report: LintReport): number {
    if (report.errorCount > 0) return 1;
    if (report.warningCount > 0) return 2;
    return 0;
  }

  private async checkMermaid(sddPath?: string): Promise<LintFinding[]> {
    const target = sddPath ?? path.join(this.cwd, DEFAULTS.outputSddFile);
    let markdown: string;
    try {
      markdown = await this.files.read(target);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        return [
          {
            rule: 'no-rendered-spec',
            severity: 'warning',
            path: target,
            message: `No rendered SDD found at ${target} — run \`sdd spec\` to generate it.`,
          },
        ];
      }
      throw error;
    }

    const out: LintFinding[] = [];
    const blocks = this.mermaid.extractFenced(markdown);
    blocks.forEach((block, idx) => {
      const result = this.mermaid.validate(block);
      if (!result.valid) {
        out.push({
          rule: 'mermaid-invalid',
          severity: 'error',
          path: `${target}#mermaid-block-${idx + 1}`,
          message: `Mermaid block ${idx + 1} failed validation: ${result.reason ?? 'unknown'}`,
        });
      }
    });
    return out;
  }

  private async loadRequirements(): Promise<RequirementsDocument> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    const raw = await this.files.readJson<unknown>(filePath);
    return requirementsDocumentSchema.parse(raw);
  }

  private async loadIntegrations(): Promise<readonly Integration[]> {
    const filePath = path.join(this.cwd, DEFAULTS.integrationsFile);
    if (!(await this.files.exists(filePath))) {
      return [];
    }
    const raw = await this.files.readJson<unknown>(filePath);
    const doc: IntegrationsDocument = integrationsDocumentSchema.parse(raw);
    return doc.integrations;
  }
}

export type { LintFinding, LintReport };
