import { integrationsDocumentSchema, integrationSchema } from '../utils/validators';

import { IdGenerator } from './IdGenerator';
import { ID_PREFIXES, SCHEMA_VERSION } from './models';
import type { Integration, IntegrationsDocument } from './models';


export class IntegrationCatalog {
  private readonly idGen: IdGenerator;
  private items: Map<string, Integration>;
  private schemaVersion: number;

  public constructor(idGen: IdGenerator = new IdGenerator()) {
    this.idGen = idGen;
    this.items = new Map();
    this.schemaVersion = SCHEMA_VERSION;
  }

  public load(input: unknown): void {
    const parsed = integrationsDocumentSchema.parse(input);
    this.schemaVersion = parsed.schemaVersion;
    this.items = new Map(parsed.integrations.map((i) => [i.id, i]));
  }

  public list(): readonly Integration[] {
    return Array.from(this.items.values());
  }

  public ids(): ReadonlySet<string> {
    return new Set(this.items.keys());
  }

  public get(id: string): Integration | undefined {
    return this.items.get(id);
  }

  public add(integration: Omit<Integration, 'id'>): Integration {
    const validated = integrationSchema
      .omit({ id: true })
      .parse(integration);
    const id = this.idGen.next(ID_PREFIXES.integration, Array.from(this.items.keys()));
    const created: Integration = { id, ...validated };
    this.items.set(id, created);
    return created;
  }

  public update(id: string, patch: Partial<Omit<Integration, 'id'>>): Integration {
    const existing = this.requireExisting(id);
    const merged = { ...existing, ...patch };
    const validated = integrationSchema.parse(merged);
    this.items.set(id, validated);
    return validated;
  }

  public remove(id: string): void {
    if (!this.items.has(id)) {
      throw new Error(`Integration not found: ${id}`);
    }
    this.items.delete(id);
  }

  public toDocument(): IntegrationsDocument {
    const doc: IntegrationsDocument = {
      schemaVersion: this.schemaVersion,
      integrations: this.list(),
    };
    return integrationsDocumentSchema.parse(doc);
  }

  public requireExisting(id: string): Integration {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Integration not found: ${id}`);
    }
    return existing;
  }
}
