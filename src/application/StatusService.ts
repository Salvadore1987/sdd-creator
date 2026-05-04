import * as path from 'path';

import type {
  Integration,
  IntegrationsDocument,
  RequirementTopic,
  RequirementsDocument,
  SectionStatus,
} from '../domain/models';
import type { IFileRepository } from '../ports/IFileRepository';
import { DEFAULTS } from '../utils/constants';
import { integrationsDocumentSchema, requirementsDocumentSchema } from '../utils/validators';

export interface StatusEntry {
  readonly key: RequirementTopic | 'integrations' | 'adrs' | 'risks';
  readonly label: string;
  readonly status: SectionStatus | 'present';
  readonly count: number;
  readonly nextCommand: string;
}

export interface StatusReport {
  readonly entries: readonly StatusEntry[];
  readonly summary: { readonly completed: number; readonly skipped: number; readonly stale: number; readonly pending: number };
}

const TOPICS: readonly RequirementTopic[] = [
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

export interface StatusServiceDeps {
  readonly files: IFileRepository;
}

export interface StatusServiceOptions {
  readonly cwd: string;
}

export class StatusService {
  private readonly files: IFileRepository;
  private readonly cwd: string;

  public constructor(deps: StatusServiceDeps, options: StatusServiceOptions) {
    this.files = deps.files;
    this.cwd = options.cwd;
  }

  public async report(): Promise<StatusReport> {
    const requirements = await this.loadRequirements();
    const integrations = await this.loadIntegrations();
    const entries: StatusEntry[] = [];

    for (const topic of TOPICS) {
      const section = requirements[topic];
      const state = (section as { state: { status: SectionStatus } }).state;
      const items = this.countItems(section);
      entries.push({
        key: topic,
        label: topic,
        status: state.status,
        count: items,
        nextCommand:
          state.status === 'skipped' || state.status === 'pending'
            ? `sdd add ${topic}`
            : state.status === 'stale'
              ? `sdd edit ${topic}`
              : `sdd edit ${topic}`,
      });
    }

    entries.push({
      key: 'adrs',
      label: 'ADRs',
      status: requirements.adrs.length > 0 ? 'present' : 'pending',
      count: requirements.adrs.length,
      nextCommand: 'sdd add adr',
    });
    entries.push({
      key: 'risks',
      label: 'Risks',
      status: requirements.risks.length > 0 ? 'present' : 'pending',
      count: requirements.risks.length,
      nextCommand: 'sdd add risk',
    });
    entries.push({
      key: 'integrations',
      label: 'Integrations',
      status: integrations.length > 0 ? 'present' : 'pending',
      count: integrations.length,
      nextCommand: 'sdd add integration',
    });

    const summary = {
      completed: entries.filter((e) => e.status === 'completed').length,
      skipped: entries.filter((e) => e.status === 'skipped').length,
      stale: entries.filter((e) => e.status === 'stale').length,
      pending: entries.filter((e) => e.status === 'pending').length,
    };
    return { entries, summary };
  }

  private countItems(section: unknown): number {
    if (section === null || typeof section !== 'object') {
      return 0;
    }
    const obj = section as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items.length;
    if (Array.isArray(obj.terms)) return obj.terms.length;
    if (Array.isArray(obj.aggregates)) return obj.aggregates.length;
    if (Array.isArray(obj.nfrs)) return obj.nfrs.length;
    if (Array.isArray(obj.integrationRefs)) return obj.integrationRefs.length;
    if (typeof obj.statement === 'string') return 1;
    return 0;
  }

  private async loadRequirements(): Promise<RequirementsDocument> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    if (!(await this.files.exists(filePath))) {
      throw new Error('No requirements found — run `sdd init` first.');
    }
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
