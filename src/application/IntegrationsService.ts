import * as path from 'path';

import type { ConfigManager } from '../domain/ConfigManager';
import { IntegrationCatalog } from '../domain/IntegrationCatalog';
import { IntegrationCategoryRegistry } from '../domain/IntegrationCategoryRegistry';
import {
  type Integration,
  type IntegrationsDocument,
  type RequirementsDocument,
} from '../domain/models';
import { FileNotFoundError } from '../ports/errors';
import type { IFileRepository } from '../ports/IFileRepository';
import type { IIntegrationImporter, ImportFormat } from '../ports/IIntegrationImporter';
import type { ILogger } from '../ports/ILogger';
import type { ITemplateEngine } from '../ports/ITemplateEngine';
import { DEFAULTS } from '../utils/constants';
import { integrationsDocumentSchema, requirementsDocumentSchema } from '../utils/validators';

export interface ValidationFinding {
  readonly id: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface ValidationReport {
  readonly findings: readonly ValidationFinding[];
  readonly errorCount: number;
  readonly warningCount: number;
}

export interface SpecResult {
  readonly outputPath: string;
  readonly markdown: string;
}

export interface IntegrationsServiceDeps {
  readonly files: IFileRepository;
  readonly templateEngine: ITemplateEngine;
  readonly configManager: ConfigManager;
  readonly registry?: IntegrationCategoryRegistry;
  readonly logger: ILogger;
}

export interface IntegrationsServiceOptions {
  readonly cwd: string;
  readonly templatesRoot: string;
  readonly importers?: readonly IIntegrationImporter[];
}

export class IntegrationsService {
  private readonly files: IFileRepository;
  private readonly templateEngine: ITemplateEngine;
  private readonly configManager: ConfigManager;
  private readonly registry: IntegrationCategoryRegistry;
  private readonly logger: ILogger;
  private readonly cwd: string;
  private readonly templatesRoot: string;
  private readonly importers: readonly IIntegrationImporter[];

  public constructor(deps: IntegrationsServiceDeps, options: IntegrationsServiceOptions) {
    this.files = deps.files;
    this.templateEngine = deps.templateEngine;
    this.configManager = deps.configManager;
    this.registry = deps.registry ?? new IntegrationCategoryRegistry();
    this.logger = deps.logger;
    this.cwd = options.cwd;
    this.templatesRoot = options.templatesRoot;
    this.importers = options.importers ?? [];
  }

  public async list(): Promise<readonly Integration[]> {
    const catalog = await this.loadCatalog();
    return catalog.list();
  }

  public async show(id: string): Promise<Integration> {
    const catalog = await this.loadCatalog();
    return catalog.requireExisting(id);
  }

  public async add(input: Omit<Integration, 'id'>): Promise<Integration> {
    const catalog = await this.loadCatalog();
    this.registry.validateExtra(input.category, input.extra);
    const created = catalog.add(input);
    await this.persist(catalog.toDocument());
    return created;
  }

  public async edit(id: string, patch: Partial<Omit<Integration, 'id'>>): Promise<Integration> {
    const catalog = await this.loadCatalog();
    const existing = catalog.requireExisting(id);
    if (patch.category !== undefined && patch.category !== existing.category) {
      throw new Error('Changing integration category is not supported. Remove and re-add instead.');
    }
    if (patch.extra !== undefined) {
      this.registry.validateExtra(existing.category, patch.extra);
    }
    const updated = catalog.update(id, patch);
    await this.persist(catalog.toDocument());
    return updated;
  }

  public async remove(id: string): Promise<void> {
    const catalog = await this.loadCatalog();
    catalog.remove(id);
    await this.persist(catalog.toDocument());
  }

  public async validate(): Promise<ValidationReport> {
    const catalog = await this.loadCatalog();
    const findings: ValidationFinding[] = [];
    for (const integration of catalog.list()) {
      try {
        this.registry.validateExtra(integration.category, integration.extra);
      } catch (error) {
        findings.push({
          id: integration.id,
          severity: 'error',
          message: `Category-specific validation failed: ${(error as Error).message}`,
        });
      }
      if (integration.endpoints.length === 0) {
        findings.push({
          id: integration.id,
          severity: 'error',
          message: 'Integration must have at least one endpoint.',
        });
      }
      if (integration.auth?.secretsRef === undefined) {
        findings.push({
          id: integration.id,
          severity: 'warning',
          message: 'auth.secretsRef is missing — credentials should reference a vault path, not be inlined.',
        });
      }
    }
    return {
      findings,
      errorCount: findings.filter((f) => f.severity === 'error').length,
      warningCount: findings.filter((f) => f.severity === 'warning').length,
    };
  }

  public async import(format: ImportFormat, filePath: string): Promise<readonly Integration[]> {
    const importer = this.importers.find((i) => i.canImport(format));
    if (importer === undefined) {
      throw new Error(`No importer registered for format "${format}"`);
    }
    const drafts = await importer.import(filePath);
    const catalog = await this.loadCatalog();
    const created: Integration[] = [];
    for (const draft of drafts) {
      const { id: _ignored, ...rest } = draft;
      void _ignored;
      this.registry.validateExtra(rest.category, rest.extra);
      const next = catalog.add(rest);
      created.push(next);
    }
    await this.persist(catalog.toDocument());
    return created;
  }

  public async generateSpec(outputPath?: string): Promise<SpecResult> {
    const config = await this.configManager.load();
    const catalog = await this.loadCatalog();
    const integrations = catalog.list();
    const requirements = await this.tryLoadRequirements();
    const usage = this.buildUsageMap(integrations, requirements);

    const overview = await this.readTemplate(path.join(this.templatesRoot, 'integrations', '_base', 'overview.hbs'));
    const crossCutting = await this.readTemplate(
      path.join(this.templatesRoot, 'integrations', '_base', 'cross-cutting.hbs'),
    );
    const traceability = await this.readTemplate(
      path.join(this.templatesRoot, 'integrations', '_base', 'traceability.hbs'),
    );
    const sectionTemplate = await this.readTemplate(
      path.join(this.templatesRoot, 'integrations', '_base', 'section.hbs'),
    );

    const renderedSections: string[] = [];
    for (const integration of integrations) {
      const descriptor = this.registry.get(integration.category);
      const section = this.templateEngine.render(sectionTemplate, {
        integration,
        categoryExtraJson: JSON.stringify(integration.extra ?? {}, null, 2),
        config,
      });
      let diagram = '';
      if (descriptor.hasDiagram) {
        const diagramTemplate = await this.tryReadTemplate(
          path.join(this.templatesRoot, 'integrations', integration.category, 'diagram.hbs'),
        );
        if (diagramTemplate !== undefined) {
          diagram = this.templateEngine.render(diagramTemplate, { integration, config });
        }
      }
      renderedSections.push(section + (diagram === '' ? '' : `\n${diagram}\n`));
    }

    const overviewMd = this.templateEngine.render(overview, {
      config,
      integrations,
      generatedAt: new Date().toISOString(),
    });
    const crossCuttingMd = this.templateEngine.render(crossCutting, { config });
    const traceabilityMd = this.templateEngine.render(traceability, { integrations, usage });

    const markdown = [overviewMd, crossCuttingMd, '## Entries', renderedSections.join('\n\n'), traceabilityMd].join('\n');
    const target =
      outputPath ?? path.join(this.cwd, DEFAULTS.outputIntegrationsFile);
    await this.files.write(target, markdown);
    this.logger.info('Wrote INTEGRATIONS.md', { target });
    return { outputPath: target, markdown };
  }

  private buildUsageMap(
    integrations: readonly Integration[],
    requirements: RequirementsDocument | undefined,
  ): Readonly<Record<string, string>> {
    const map: Record<string, string> = {};
    for (const integration of integrations) {
      map[integration.id] = '—';
    }
    if (requirements === undefined) {
      return map;
    }
    for (const feature of requirements.features.items) {
      for (const intId of feature.usesIntegrations ?? []) {
        const previous = map[intId];
        const tag = `${feature.id}`;
        map[intId] = previous === undefined || previous === '—' ? tag : `${previous}, ${tag}`;
      }
    }
    return map;
  }

  private async loadCatalog(): Promise<IntegrationCatalog> {
    const catalog = new IntegrationCatalog();
    const filePath = path.join(this.cwd, DEFAULTS.integrationsFile);
    if (!(await this.files.exists(filePath))) {
      catalog.load({ schemaVersion: 1, integrations: [] });
      return catalog;
    }
    const raw = await this.files.readJson<unknown>(filePath);
    catalog.load(raw);
    return catalog;
  }

  private async tryLoadRequirements(): Promise<RequirementsDocument | undefined> {
    const filePath = path.join(this.cwd, DEFAULTS.requirementsFile);
    if (!(await this.files.exists(filePath))) {
      return undefined;
    }
    const raw = await this.files.readJson<unknown>(filePath);
    return requirementsDocumentSchema.parse(raw);
  }

  private async persist(doc: IntegrationsDocument): Promise<void> {
    const filePath = path.join(this.cwd, DEFAULTS.integrationsFile);
    await this.files.writeJson(filePath, integrationsDocumentSchema.parse(doc));
  }

  private async readTemplate(filePath: string): Promise<string> {
    return this.files.read(filePath);
  }

  private async tryReadTemplate(filePath: string): Promise<string | undefined> {
    try {
      return await this.files.read(filePath);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }
}
