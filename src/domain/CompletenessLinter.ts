import type { Integration, RequirementsDocument } from './models';

export type LintSeverity = 'error' | 'warning';

export interface LintFinding {
  readonly rule: string;
  readonly severity: LintSeverity;
  readonly path: string;
  readonly message: string;
}

export interface LintReport {
  readonly findings: readonly LintFinding[];
  readonly errorCount: number;
  readonly warningCount: number;
}

export interface LintInput {
  readonly requirements: RequirementsDocument;
  readonly integrations: readonly Integration[];
  readonly strict?: boolean;
}

const ARC42_REQUIRED_TOPICS: ReadonlyArray<keyof RequirementsDocument> = [
  'stakeholders',
  'context',
  'constraints',
  'glossary',
  'features',
  'domain',
  'quality',
  'dependencies',
  'anti',
  'compliance',
];

export class CompletenessLinter {
  public lint(input: LintInput): LintReport {
    const findings: LintFinding[] = [];
    const strict = input.strict ?? false;

    findings.push(...this.checkFeatures(input.requirements));
    findings.push(...this.checkNfrs(input.requirements));
    findings.push(...this.checkReferences(input.requirements, input.integrations));
    findings.push(...this.checkIntegrations(input.integrations));
    findings.push(...this.checkSkippedSections(input.requirements, strict));
    if (strict) {
      findings.push(...this.checkArc42Coverage(input.requirements));
    }

    const errorCount = findings.filter((f) => f.severity === 'error').length;
    const warningCount = findings.filter((f) => f.severity === 'warning').length;
    return { findings, errorCount, warningCount };
  }

  private checkFeatures(doc: RequirementsDocument): LintFinding[] {
    const out: LintFinding[] = [];
    for (const feature of doc.features.items) {
      if (feature.acceptanceCriteria.length === 0) {
        out.push({
          rule: 'fr-without-ac',
          severity: 'error',
          path: `features.items[${feature.id}]`,
          message: `Feature ${feature.id} has no acceptance criteria`,
        });
      }
    }
    return out;
  }

  private checkNfrs(doc: RequirementsDocument): LintFinding[] {
    const out: LintFinding[] = [];
    for (const nfr of doc.quality.nfrs) {
      if (nfr.measurableTarget.trim() === '') {
        out.push({
          rule: 'nfr-without-target',
          severity: 'error',
          path: `quality.nfrs[${nfr.id}]`,
          message: `NFR ${nfr.id} has no measurable target`,
        });
      }
    }
    return out;
  }

  private checkReferences(
    doc: RequirementsDocument,
    integrations: readonly Integration[],
  ): LintFinding[] {
    const out: LintFinding[] = [];
    const knownIntegrationIds = new Set(integrations.map((i) => i.id));
    const knownFeatureIds = new Set(doc.features.items.map((f) => f.id));

    for (const feature of doc.features.items) {
      for (const ref of feature.usesIntegrations ?? []) {
        if (!knownIntegrationIds.has(ref)) {
          out.push({
            rule: 'unresolved-reference',
            severity: 'error',
            path: `features.items[${feature.id}].usesIntegrations`,
            message: `Reference to unknown integration ${ref}`,
          });
        }
      }
    }
    for (const adr of doc.adrs) {
      for (const ref of adr.relatedRequirements ?? []) {
        if (!knownFeatureIds.has(ref)) {
          out.push({
            rule: 'unresolved-reference',
            severity: 'error',
            path: `adrs[${adr.id}].relatedRequirements`,
            message: `Reference to unknown requirement ${ref}`,
          });
        }
      }
    }
    return out;
  }

  private checkIntegrations(integrations: readonly Integration[]): LintFinding[] {
    const out: LintFinding[] = [];
    for (const integration of integrations) {
      if (integration.auth && integration.auth.secretsRef === undefined) {
        out.push({
          rule: 'integration-missing-secrets-ref',
          severity: 'warning',
          path: `integrations[${integration.id}].auth`,
          message: `Integration ${integration.id} declares auth without secretsRef`,
        });
      }
    }
    return out;
  }

  private checkSkippedSections(doc: RequirementsDocument, strict: boolean): LintFinding[] {
    const out: LintFinding[] = [];
    for (const topic of ARC42_REQUIRED_TOPICS) {
      const section = doc[topic];
      const state = (section as { state?: { status?: string } }).state;
      if (state?.status === 'skipped') {
        out.push({
          rule: 'section-skipped',
          severity: strict ? 'error' : 'warning',
          path: `${String(topic)}.state`,
          message: `Section "${String(topic)}" is skipped`,
        });
      }
    }
    return out;
  }

  private checkArc42Coverage(doc: RequirementsDocument): LintFinding[] {
    const out: LintFinding[] = [];
    for (const topic of ARC42_REQUIRED_TOPICS) {
      const section = doc[topic];
      const state = (section as { state?: { status?: string } }).state;
      if (state?.status !== 'completed') {
        out.push({
          rule: 'arc42-coverage',
          severity: 'error',
          path: `${String(topic)}.state`,
          message: `Section "${String(topic)}" is not completed (arc42 coverage)`,
        });
      }
    }
    return out;
  }
}
