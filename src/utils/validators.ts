import { z } from 'zod';

import { SCHEMA_VERSION } from '../domain/models';

const stableIdRegex = /^[A-Z]+-\d{3,}$/;
const acIdRegex = /^AC-[A-Z]+-\d+-\d+$/;

export const stableIdSchema = z.string().regex(stableIdRegex, 'Expected stable ID like FR-001');
export const acIdSchema = z.string().regex(acIdRegex, 'Expected acceptance ID like AC-FR-001-1');

export const stackSchema = z.enum(['java', 'node', 'python', 'go', 'rust']);
export const architectureSchema = z.enum([
  'hexagonal',
  'layered',
  'microservices',
  'event-driven',
  'monolith',
]);
export const claudeProviderSchema = z.enum(['cli', 'api']);
export const languageSchema = z.enum(['ru', 'en']);
export const sectionStatusSchema = z.enum(['pending', 'completed', 'skipped', 'stale']);

export const claudeConfigSchema = z.object({
  provider: claudeProviderSchema,
  model: z.string().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const projectMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  repository: z.string().optional(),
});

export const projectConfigSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  metadata: projectMetadataSchema,
  stack: stackSchema,
  architecture: architectureSchema,
  language: languageSchema,
  technologies: z.array(z.string().min(1)),
  claude: claudeConfigSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const sectionStateSchema = z.object({
  status: sectionStatusSchema,
  updatedAt: z.string().optional(),
  skippedAt: z.string().optional(),
  inputsHash: z.string().optional(),
});

export const acceptanceCriterionSchema = z.object({
  id: acIdSchema,
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

export const requirementSchema = z.object({
  id: stableIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['must', 'should', 'could', 'wont']),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  usesIntegrations: z.array(stableIdSchema).optional(),
  tags: z.array(z.string()).optional(),
});

export const nfrSchema = z.object({
  id: stableIdSchema,
  category: z.enum([
    'performance',
    'reliability',
    'security',
    'usability',
    'maintainability',
    'portability',
    'observability',
    'compliance',
  ]),
  statement: z.string().min(1),
  measurableTarget: z.string().min(1),
  verificationMethod: z.string().optional(),
});

export const adrSchema = z.object({
  id: stableIdSchema,
  title: z.string().min(1),
  status: z.enum(['proposed', 'accepted', 'deprecated', 'superseded']),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
  relatedRequirements: z.array(stableIdSchema).optional(),
  createdAt: z.string().min(1),
});

export const riskSchema = z.object({
  id: stableIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  likelihood: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  mitigation: z.string().min(1),
  owner: z.string().optional(),
});

export const stakeholderSchema = z.object({
  id: stableIdSchema,
  name: z.string().min(1),
  role: z.string().min(1),
  responsibilities: z.array(z.string()),
  influence: z.enum(['low', 'medium', 'high']).optional(),
});

export const glossaryTermSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  synonyms: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
});

export const domainAggregateSchema = z.object({
  name: z.string().min(1),
  boundedContext: z.string().min(1),
  description: z.string().min(1),
  entities: z.array(z.string()),
  valueObjects: z.array(z.string()),
  events: z.array(z.string()),
});

export const integrationCategorySchema = z.enum([
  'bpms',
  'message-broker',
  'database',
  'cache',
  'search',
  'identity',
  'storage',
  'observability',
  'payment',
  'notification',
  'external-api',
  'legacy',
  'custom',
]);

export const integrationEndpointSchema = z.object({
  name: z.string().min(1),
  protocol: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

export const integrationSchema = z.object({
  id: stableIdSchema,
  category: integrationCategorySchema,
  name: z.string().min(1),
  vendor: z.string().optional(),
  purpose: z.string().min(1),
  endpoints: z.array(integrationEndpointSchema),
  slaTargets: z
    .object({
      availability: z.string().optional(),
      latencyP95Ms: z.number().int().positive().optional(),
    })
    .optional(),
  auth: z
    .object({
      mode: z.string().min(1),
      secretsRef: z.string().optional(),
    })
    .optional(),
  errorHandling: z.string().optional(),
  rateLimits: z.string().optional(),
  observability: z.string().optional(),
  versioning: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
});

export const integrationsDocumentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  integrations: z.array(integrationSchema),
});

export const requirementsDocumentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  stakeholders: z.object({
    state: sectionStateSchema,
    items: z.array(stakeholderSchema),
  }),
  context: z.object({
    state: sectionStateSchema,
    statement: z.string().optional(),
    goals: z.array(z.string()).optional(),
    kpis: z.array(z.string()).optional(),
  }),
  constraints: z.object({
    state: sectionStateSchema,
    items: z.array(z.string()),
  }),
  glossary: z.object({
    state: sectionStateSchema,
    terms: z.array(glossaryTermSchema),
  }),
  features: z.object({
    state: sectionStateSchema,
    items: z.array(requirementSchema),
  }),
  domain: z.object({
    state: sectionStateSchema,
    aggregates: z.array(domainAggregateSchema),
  }),
  quality: z.object({
    state: sectionStateSchema,
    nfrs: z.array(nfrSchema),
  }),
  dependencies: z.object({
    state: sectionStateSchema,
    integrationRefs: z.array(stableIdSchema),
  }),
  anti: z.object({
    state: sectionStateSchema,
    items: z.array(z.string()),
  }),
  compliance: z.object({
    state: sectionStateSchema,
    items: z.array(z.string()),
  }),
  adrs: z.array(adrSchema),
  risks: z.array(riskSchema),
});
