import {
  acceptanceCriterionSchema,
  adrSchema,
  glossaryTermSchema,
  nfrSchema,
  requirementSchema,
  requirementsDocumentSchema,
  riskSchema,
  stakeholderSchema,
} from '../utils/validators';

import type {
  ADR,
  AcceptanceCriterion,
  GlossaryTerm,
  NFR,
  Requirement,
  RequirementsDocument,
  Risk,
  Stakeholder,
} from './models';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class RequirementValidator {
  public validateDocument(input: unknown): RequirementsDocument {
    return requirementsDocumentSchema.parse(input);
  }

  public validateRequirement(input: unknown): Requirement {
    return requirementSchema.parse(input);
  }

  public validateNfr(input: unknown): NFR {
    return nfrSchema.parse(input);
  }

  public validateAdr(input: unknown): ADR {
    return adrSchema.parse(input);
  }

  public validateRisk(input: unknown): Risk {
    return riskSchema.parse(input);
  }

  public validateStakeholder(input: unknown): Stakeholder {
    return stakeholderSchema.parse(input);
  }

  public validateAcceptanceCriterion(input: unknown): AcceptanceCriterion {
    return acceptanceCriterionSchema.parse(input);
  }

  public validateGlossaryTerm(input: unknown): GlossaryTerm {
    return glossaryTermSchema.parse(input);
  }

  public checkReferentialIntegrity(
    doc: RequirementsDocument,
    knownIntegrationIds: ReadonlySet<string>,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const knownFeatureIds = new Set(doc.features.items.map((r) => r.id));

    for (const feature of doc.features.items) {
      for (const ref of feature.usesIntegrations ?? []) {
        if (!knownIntegrationIds.has(ref)) {
          issues.push({
            path: `features.items[${feature.id}].usesIntegrations`,
            message: `Unknown integration ID: ${ref}`,
          });
        }
      }
      for (const ac of feature.acceptanceCriteria) {
        if (!ac.id.startsWith(`AC-${feature.id}-`)) {
          issues.push({
            path: `features.items[${feature.id}].acceptanceCriteria[${ac.id}]`,
            message: `AC id ${ac.id} does not match parent feature ${feature.id}`,
          });
        }
      }
    }

    for (const ref of doc.dependencies.integrationRefs) {
      if (!knownIntegrationIds.has(ref)) {
        issues.push({
          path: 'dependencies.integrationRefs',
          message: `Unknown integration ID: ${ref}`,
        });
      }
    }

    for (const adr of doc.adrs) {
      for (const ref of adr.relatedRequirements ?? []) {
        if (!knownFeatureIds.has(ref)) {
          issues.push({
            path: `adrs[${adr.id}].relatedRequirements`,
            message: `Unknown requirement ID: ${ref}`,
          });
        }
      }
    }

    return issues;
  }
}
