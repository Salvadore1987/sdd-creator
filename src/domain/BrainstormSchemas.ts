import { z } from 'zod';

import type { RequirementTopic } from './models';

const priority = z.enum(['must', 'should', 'could', 'wont']);
const influence = z.enum(['low', 'medium', 'high']).optional();
const nfrCategory = z.enum([
  'performance',
  'reliability',
  'security',
  'usability',
  'maintainability',
  'portability',
  'observability',
  'compliance',
]);

export const stakeholdersResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      responsibilities: z.array(z.string().min(1)),
      influence,
    }),
  ),
});

export const contextResponseSchema = z.object({
  statement: z.string().min(1).optional(),
  goals: z.array(z.string().min(1)).optional(),
  kpis: z.array(z.string().min(1)).optional(),
});

export const constraintsResponseSchema = z.object({
  items: z.array(z.string().min(1)),
});

export const glossaryResponseSchema = z.object({
  terms: z.array(
    z.object({
      term: z.string().min(1),
      definition: z.string().min(1),
      synonyms: z.array(z.string().min(1)).optional(),
      relatedTerms: z.array(z.string().min(1)).optional(),
    }),
  ),
});

const acceptanceCriterionResponseSchema = z.object({
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

export const featuresResponseSchema = z.object({
  items: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      priority,
      acceptanceCriteria: z.array(acceptanceCriterionResponseSchema),
      usesIntegrations: z.array(z.string().min(1)).optional(),
      tags: z.array(z.string().min(1)).optional(),
    }),
  ),
});

export const domainResponseSchema = z.object({
  aggregates: z.array(
    z.object({
      name: z.string().min(1),
      boundedContext: z.string().min(1),
      description: z.string().min(1),
      entities: z.array(z.string().min(1)),
      valueObjects: z.array(z.string().min(1)),
      events: z.array(z.string().min(1)),
    }),
  ),
});

export const qualityResponseSchema = z.object({
  nfrs: z.array(
    z.object({
      category: nfrCategory,
      statement: z.string().min(1),
      measurableTarget: z.string().min(1),
      verificationMethod: z.string().min(1).optional(),
    }),
  ),
});

export const dependenciesResponseSchema = z.object({
  integrationRefs: z.array(z.string().min(1)),
});

export const antiResponseSchema = z.object({
  items: z.array(z.string().min(1)),
});

export const complianceResponseSchema = z.object({
  items: z.array(z.string().min(1)),
});

export type BrainstormResponseByTopic = {
  stakeholders: z.infer<typeof stakeholdersResponseSchema>;
  context: z.infer<typeof contextResponseSchema>;
  constraints: z.infer<typeof constraintsResponseSchema>;
  glossary: z.infer<typeof glossaryResponseSchema>;
  features: z.infer<typeof featuresResponseSchema>;
  domain: z.infer<typeof domainResponseSchema>;
  quality: z.infer<typeof qualityResponseSchema>;
  dependencies: z.infer<typeof dependenciesResponseSchema>;
  anti: z.infer<typeof antiResponseSchema>;
  compliance: z.infer<typeof complianceResponseSchema>;
};

export const RESPONSE_SCHEMAS: { [K in RequirementTopic]: z.ZodType<BrainstormResponseByTopic[K]> } = {
  stakeholders: stakeholdersResponseSchema,
  context: contextResponseSchema,
  constraints: constraintsResponseSchema,
  glossary: glossaryResponseSchema,
  features: featuresResponseSchema,
  domain: domainResponseSchema,
  quality: qualityResponseSchema,
  dependencies: dependenciesResponseSchema,
  anti: antiResponseSchema,
  compliance: complianceResponseSchema,
};

export function getResponseSchema<T extends RequirementTopic>(
  topic: T,
): z.ZodType<BrainstormResponseByTopic[T]> {
  return RESPONSE_SCHEMAS[topic];
}
