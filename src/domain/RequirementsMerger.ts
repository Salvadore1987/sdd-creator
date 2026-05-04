import type { BrainstormResponseByTopic } from './BrainstormSchemas';
import { IdGenerator } from './IdGenerator';
import {
  ID_PREFIXES,
  type RequirementTopic,
  type RequirementsDocument,
  type SectionState,
} from './models';

export interface MergeOptions {
  readonly state: SectionState;
}

export class RequirementsMerger {
  public constructor(private readonly idGenerator: IdGenerator = new IdGenerator()) {}

  public merge<T extends RequirementTopic>(
    document: RequirementsDocument,
    topic: T,
    response: BrainstormResponseByTopic[T],
    options: MergeOptions,
  ): RequirementsDocument {
    switch (topic) {
      case 'stakeholders':
        return this.mergeStakeholders(document, response as BrainstormResponseByTopic['stakeholders'], options);
      case 'context':
        return this.mergeContext(document, response as BrainstormResponseByTopic['context'], options);
      case 'constraints':
        return this.mergeConstraints(document, response as BrainstormResponseByTopic['constraints'], options);
      case 'glossary':
        return this.mergeGlossary(document, response as BrainstormResponseByTopic['glossary'], options);
      case 'features':
        return this.mergeFeatures(document, response as BrainstormResponseByTopic['features'], options);
      case 'domain':
        return this.mergeDomain(document, response as BrainstormResponseByTopic['domain'], options);
      case 'quality':
        return this.mergeQuality(document, response as BrainstormResponseByTopic['quality'], options);
      case 'dependencies':
        return this.mergeDependencies(document, response as BrainstormResponseByTopic['dependencies'], options);
      case 'anti':
        return this.mergeAnti(document, response as BrainstormResponseByTopic['anti'], options);
      case 'compliance':
        return this.mergeCompliance(document, response as BrainstormResponseByTopic['compliance'], options);
      default: {
        const exhaustive: never = topic;
        throw new Error(`Unknown topic: ${String(exhaustive)}`);
      }
    }
  }

  private mergeStakeholders(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['stakeholders'],
    options: MergeOptions,
  ): RequirementsDocument {
    const existingIds = doc.stakeholders.items.map((s) => s.id);
    const items = response.items.map((item) => {
      const id = this.idGenerator.next(ID_PREFIXES.stakeholder, [
        ...existingIds,
        // include freshly assigned IDs to keep ordinals strictly increasing
      ]);
      existingIds.push(id);
      return {
        id,
        name: item.name,
        role: item.role,
        responsibilities: [...item.responsibilities],
        ...(item.influence !== undefined ? { influence: item.influence } : {}),
      };
    });
    return {
      ...doc,
      stakeholders: {
        state: options.state,
        items: [...doc.stakeholders.items, ...items],
      },
    };
  }

  private mergeContext(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['context'],
    options: MergeOptions,
  ): RequirementsDocument {
    return {
      ...doc,
      context: {
        state: options.state,
        ...(response.statement !== undefined ? { statement: response.statement } : {}),
        ...(response.goals !== undefined ? { goals: [...response.goals] } : {}),
        ...(response.kpis !== undefined ? { kpis: [...response.kpis] } : {}),
      },
    };
  }

  private mergeConstraints(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['constraints'],
    options: MergeOptions,
  ): RequirementsDocument {
    const next = this.dedupe([...doc.constraints.items, ...response.items]);
    return {
      ...doc,
      constraints: { state: options.state, items: next },
    };
  }

  private mergeGlossary(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['glossary'],
    options: MergeOptions,
  ): RequirementsDocument {
    const seen = new Set(doc.glossary.terms.map((t) => t.term.toLowerCase()));
    const additions = response.terms
      .filter((t) => !seen.has(t.term.toLowerCase()))
      .map((t) => ({
        term: t.term,
        definition: t.definition,
        ...(t.synonyms !== undefined ? { synonyms: [...t.synonyms] } : {}),
        ...(t.relatedTerms !== undefined ? { relatedTerms: [...t.relatedTerms] } : {}),
      }));
    return {
      ...doc,
      glossary: {
        state: options.state,
        terms: [...doc.glossary.terms, ...additions],
      },
    };
  }

  private mergeFeatures(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['features'],
    options: MergeOptions,
  ): RequirementsDocument {
    const existingFeatureIds = doc.features.items.map((f) => f.id);
    const newItems = response.items.map((item) => {
      const id = this.idGenerator.next(ID_PREFIXES.feature, existingFeatureIds);
      existingFeatureIds.push(id);
      const acIds: string[] = [];
      const acceptanceCriteria = item.acceptanceCriteria.map((ac) => {
        const acId = this.idGenerator.childOf(id, acIds);
        acIds.push(acId);
        return { id: acId, given: ac.given, when: ac.when, then: ac.then };
      });
      return {
        id,
        title: item.title,
        description: item.description,
        priority: item.priority,
        acceptanceCriteria,
        ...(item.usesIntegrations !== undefined ? { usesIntegrations: [...item.usesIntegrations] } : {}),
        ...(item.tags !== undefined ? { tags: [...item.tags] } : {}),
      };
    });
    return {
      ...doc,
      features: {
        state: options.state,
        items: [...doc.features.items, ...newItems],
      },
    };
  }

  private mergeDomain(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['domain'],
    options: MergeOptions,
  ): RequirementsDocument {
    const aggregates = response.aggregates.map((a) => ({
      name: a.name,
      boundedContext: a.boundedContext,
      description: a.description,
      entities: [...a.entities],
      valueObjects: [...a.valueObjects],
      events: [...a.events],
    }));
    return {
      ...doc,
      domain: {
        state: options.state,
        aggregates: [...doc.domain.aggregates, ...aggregates],
      },
    };
  }

  private mergeQuality(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['quality'],
    options: MergeOptions,
  ): RequirementsDocument {
    const existingIds = doc.quality.nfrs.map((n) => n.id);
    const nfrs = response.nfrs.map((n) => {
      const id = this.idGenerator.next(ID_PREFIXES.nfr, existingIds);
      existingIds.push(id);
      return {
        id,
        category: n.category,
        statement: n.statement,
        measurableTarget: n.measurableTarget,
        ...(n.verificationMethod !== undefined ? { verificationMethod: n.verificationMethod } : {}),
      };
    });
    return {
      ...doc,
      quality: {
        state: options.state,
        nfrs: [...doc.quality.nfrs, ...nfrs],
      },
    };
  }

  private mergeDependencies(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['dependencies'],
    options: MergeOptions,
  ): RequirementsDocument {
    const next = this.dedupe([...doc.dependencies.integrationRefs, ...response.integrationRefs]);
    return {
      ...doc,
      dependencies: { state: options.state, integrationRefs: next },
    };
  }

  private mergeAnti(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['anti'],
    options: MergeOptions,
  ): RequirementsDocument {
    const next = this.dedupe([...doc.anti.items, ...response.items]);
    return {
      ...doc,
      anti: { state: options.state, items: next },
    };
  }

  private mergeCompliance(
    doc: RequirementsDocument,
    response: BrainstormResponseByTopic['compliance'],
    options: MergeOptions,
  ): RequirementsDocument {
    const next = this.dedupe([...doc.compliance.items, ...response.items]);
    return {
      ...doc,
      compliance: { state: options.state, items: next },
    };
  }

  private dedupe(values: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
      const key = v.trim();
      if (key === '' || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(v);
    }
    return out;
  }
}
