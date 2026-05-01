export const SCHEMA_VERSION = 1 as const;

export type Stack = 'java' | 'node' | 'python' | 'go' | 'rust';

export type Architecture =
  | 'hexagonal'
  | 'layered'
  | 'microservices'
  | 'event-driven'
  | 'monolith';

export type ClaudeProviderKind = 'cli' | 'api';

export type Language = 'ru' | 'en';

export type SectionStatus = 'pending' | 'completed' | 'skipped' | 'stale';

export type RequirementTopic =
  | 'stakeholders'
  | 'context'
  | 'constraints'
  | 'glossary'
  | 'features'
  | 'domain'
  | 'quality'
  | 'dependencies'
  | 'anti'
  | 'compliance';

export type IntegrationCategory =
  | 'bpms'
  | 'message-broker'
  | 'database'
  | 'cache'
  | 'search'
  | 'identity'
  | 'storage'
  | 'observability'
  | 'payment'
  | 'notification'
  | 'external-api'
  | 'legacy'
  | 'custom';

export interface ClaudeConfig {
  readonly provider: ClaudeProviderKind;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface ProjectMetadata {
  readonly name: string;
  readonly description?: string;
  readonly owner?: string;
  readonly repository?: string;
}

export interface ProjectConfig {
  readonly schemaVersion: number;
  readonly metadata: ProjectMetadata;
  readonly stack: Stack;
  readonly architecture: Architecture;
  readonly language: Language;
  readonly technologies: readonly string[];
  readonly claude: ClaudeConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SectionState {
  readonly status: SectionStatus;
  readonly updatedAt?: string;
  readonly skippedAt?: string;
  readonly inputsHash?: string;
}

export interface AcceptanceCriterion {
  readonly id: string;
  readonly given: string;
  readonly when: string;
  readonly then: string;
}

export interface Requirement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: 'must' | 'should' | 'could' | 'wont';
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly usesIntegrations?: readonly string[];
  readonly tags?: readonly string[];
}

export interface NFR {
  readonly id: string;
  readonly category:
    | 'performance'
    | 'reliability'
    | 'security'
    | 'usability'
    | 'maintainability'
    | 'portability'
    | 'observability'
    | 'compliance';
  readonly statement: string;
  readonly measurableTarget: string;
  readonly verificationMethod?: string;
}

export interface ADR {
  readonly id: string;
  readonly title: string;
  readonly status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  readonly context: string;
  readonly decision: string;
  readonly consequences: string;
  readonly alternatives?: readonly string[];
  readonly relatedRequirements?: readonly string[];
  readonly createdAt: string;
}

export interface Risk {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly likelihood: 'low' | 'medium' | 'high';
  readonly impact: 'low' | 'medium' | 'high';
  readonly mitigation: string;
  readonly owner?: string;
}

export interface Stakeholder {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly responsibilities: readonly string[];
  readonly influence?: 'low' | 'medium' | 'high';
}

export interface GlossaryTerm {
  readonly term: string;
  readonly definition: string;
  readonly synonyms?: readonly string[];
  readonly relatedTerms?: readonly string[];
}

export interface DomainAggregate {
  readonly name: string;
  readonly boundedContext: string;
  readonly description: string;
  readonly entities: readonly string[];
  readonly valueObjects: readonly string[];
  readonly events: readonly string[];
}

export interface RequirementsDocument {
  readonly schemaVersion: number;
  readonly stakeholders: { readonly state: SectionState; readonly items: readonly Stakeholder[] };
  readonly context: { readonly state: SectionState; readonly statement?: string; readonly goals?: readonly string[]; readonly kpis?: readonly string[] };
  readonly constraints: { readonly state: SectionState; readonly items: readonly string[] };
  readonly glossary: { readonly state: SectionState; readonly terms: readonly GlossaryTerm[] };
  readonly features: { readonly state: SectionState; readonly items: readonly Requirement[] };
  readonly domain: { readonly state: SectionState; readonly aggregates: readonly DomainAggregate[] };
  readonly quality: { readonly state: SectionState; readonly nfrs: readonly NFR[] };
  readonly dependencies: { readonly state: SectionState; readonly integrationRefs: readonly string[] };
  readonly anti: { readonly state: SectionState; readonly items: readonly string[] };
  readonly compliance: { readonly state: SectionState; readonly items: readonly string[] };
  readonly adrs: readonly ADR[];
  readonly risks: readonly Risk[];
}

export interface IntegrationEndpoint {
  readonly name: string;
  readonly protocol?: string;
  readonly url?: string;
  readonly notes?: string;
}

export interface Integration {
  readonly id: string;
  readonly category: IntegrationCategory;
  readonly name: string;
  readonly vendor?: string;
  readonly purpose: string;
  readonly endpoints: readonly IntegrationEndpoint[];
  readonly slaTargets?: { readonly availability?: string; readonly latencyP95Ms?: number };
  readonly auth?: { readonly mode: string; readonly secretsRef?: string };
  readonly errorHandling?: string;
  readonly rateLimits?: string;
  readonly observability?: string;
  readonly versioning?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface IntegrationsDocument {
  readonly schemaVersion: number;
  readonly integrations: readonly Integration[];
}

export const ID_PREFIXES = {
  feature: 'FR',
  nfr: 'NFR',
  adr: 'ADR',
  risk: 'RISK',
  integration: 'INT',
  stakeholder: 'SH',
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];
