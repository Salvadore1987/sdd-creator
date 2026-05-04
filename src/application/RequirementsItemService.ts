import * as path from 'path';

import { IdGenerator } from '../domain/IdGenerator';
import type {
  ADR,
  AcceptanceCriterion,
  Requirement,
  RequirementsDocument,
  Risk,
} from '../domain/models';
import type { IFileRepository } from '../ports/IFileRepository';
import { DEFAULTS } from '../utils/constants';
import { requirementsDocumentSchema } from '../utils/validators';

export interface FeatureInput {
  readonly title: string;
  readonly description: string;
  readonly priority: Requirement['priority'];
  readonly acceptanceCriteria: ReadonlyArray<Omit<AcceptanceCriterion, 'id'>>;
  readonly usesIntegrations?: readonly string[];
  readonly tags?: readonly string[];
}

export interface AdrInput {
  readonly title: string;
  readonly status: ADR['status'];
  readonly context: string;
  readonly decision: string;
  readonly consequences: string;
  readonly alternatives?: readonly string[];
  readonly relatedRequirements?: readonly string[];
}

export interface RiskInput {
  readonly title: string;
  readonly description: string;
  readonly likelihood: Risk['likelihood'];
  readonly impact: Risk['impact'];
  readonly mitigation: string;
  readonly owner?: string;
}

export interface RequirementsItemServiceDeps {
  readonly files: IFileRepository;
}

export interface RequirementsItemServiceOptions {
  readonly cwd: string;
}

export class RequirementsItemService {
  private readonly files: IFileRepository;
  private readonly cwd: string;

  public constructor(deps: RequirementsItemServiceDeps, options: RequirementsItemServiceOptions) {
    this.files = deps.files;
    this.cwd = options.cwd;
  }

  public async addFeature(input: FeatureInput): Promise<Requirement> {
    const doc = await this.load();
    const gen = new IdGenerator();
    const featureIds = doc.features.items.map((item) => item.id);
    const id = gen.next('FR', featureIds);
    const acceptanceCriteria: AcceptanceCriterion[] = input.acceptanceCriteria.map((ac, idx) => ({
      id: `AC-${id}-${idx + 1}`,
      given: ac.given,
      when: ac.when,
      then: ac.then,
    }));
    const requirement: Requirement = {
      id,
      title: input.title,
      description: input.description,
      priority: input.priority,
      acceptanceCriteria,
      ...(input.usesIntegrations !== undefined ? { usesIntegrations: input.usesIntegrations } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    };
    const updated: RequirementsDocument = {
      ...doc,
      features: {
        state: { status: 'completed', updatedAt: new Date().toISOString() },
        items: [...doc.features.items, requirement],
      },
    };
    await this.persist(updated);
    return requirement;
  }

  public async addAdr(input: AdrInput): Promise<ADR> {
    const doc = await this.load();
    const ids = doc.adrs.map((adr) => adr.id);
    const gen = new IdGenerator();
    const id = gen.next('ADR', ids);
    const adr: ADR = {
      id,
      title: input.title,
      status: input.status,
      context: input.context,
      decision: input.decision,
      consequences: input.consequences,
      ...(input.alternatives !== undefined ? { alternatives: input.alternatives } : {}),
      ...(input.relatedRequirements !== undefined ? { relatedRequirements: input.relatedRequirements } : {}),
      createdAt: new Date().toISOString(),
    };
    const updated: RequirementsDocument = { ...doc, adrs: [...doc.adrs, adr] };
    await this.persist(updated);
    return adr;
  }

  public async addRisk(input: RiskInput): Promise<Risk> {
    const doc = await this.load();
    const ids = doc.risks.map((risk) => risk.id);
    const gen = new IdGenerator();
    const id = gen.next('RISK', ids);
    const risk: Risk = {
      id,
      title: input.title,
      description: input.description,
      likelihood: input.likelihood,
      impact: input.impact,
      mitigation: input.mitigation,
      ...(input.owner !== undefined ? { owner: input.owner } : {}),
    };
    const updated: RequirementsDocument = { ...doc, risks: [...doc.risks, risk] };
    await this.persist(updated);
    return risk;
  }

  private async load(): Promise<RequirementsDocument> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    if (!(await this.files.exists(filePath))) {
      throw new Error('No requirements found — run `sdd init` first.');
    }
    const raw = await this.files.readJson<unknown>(filePath);
    return requirementsDocumentSchema.parse(raw);
  }

  private async persist(doc: RequirementsDocument): Promise<void> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    await this.files.writeJson(filePath, requirementsDocumentSchema.parse(doc));
  }
}
