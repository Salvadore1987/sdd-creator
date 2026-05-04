import { z } from 'zod';

import type { IntegrationCategory } from './models';

export interface CategoryDescriptor {
  readonly category: IntegrationCategory;
  readonly title: string;
  readonly hasDiagram: boolean;
  readonly extraSchema: z.ZodType<Readonly<Record<string, unknown>>>;
}

const stringList = z.array(z.string().min(1));
const optString = z.string().min(1).optional();
const optInt = z.number().int().nonnegative().optional();

const bpmsExtra = z.object({
  engine: optString,
  processes: stringList.optional(),
  jobWorkers: stringList.optional(),
  correlationKeys: stringList.optional(),
  sagas: stringList.optional(),
  retentionDays: optInt,
  versioning: optString,
  bpmnFile: optString,
});

const messageBrokerExtra = z.object({
  flavor: optString,
  topics: stringList.optional(),
  exchanges: stringList.optional(),
  partitioning: optString,
  ordering: optString,
  delivery: z.enum(['at-most-once', 'at-least-once', 'exactly-once']).optional(),
  deadLetter: optString,
  retentionPolicy: optString,
  consumerGroups: stringList.optional(),
  backpressure: optString,
});

const databaseExtra = z.object({
  engine: optString,
  readWriteSplit: optString,
  replication: optString,
  migrations: optString,
  pooling: optString,
  sharding: optString,
  schemaSnippet: optString,
});

const cacheExtra = z.object({
  engine: optString,
  evictionPolicy: optString,
  ttlSeconds: optInt,
  cluster: optString,
});

const searchExtra = z.object({
  engine: optString,
  indices: stringList.optional(),
  analyzers: stringList.optional(),
});

const identityExtra = z.object({
  vendor: optString,
  realms: stringList.optional(),
  clients: stringList.optional(),
  scopes: stringList.optional(),
  tokenLifetime: optString,
  refreshLifetime: optString,
  federation: stringList.optional(),
});

const storageExtra = z.object({
  vendor: optString,
  buckets: stringList.optional(),
  encryption: optString,
  lifecyclePolicy: optString,
});

const observabilityExtra = z.object({
  signals: z.array(z.enum(['logs', 'metrics', 'traces'])).optional(),
  vendor: optString,
  dashboards: stringList.optional(),
  alertRoutes: stringList.optional(),
});

const paymentExtra = z.object({
  vendor: optString,
  currencies: stringList.optional(),
  webhookSecretsRef: optString,
  pciScope: optString,
});

const notificationExtra = z.object({
  vendor: optString,
  channels: stringList.optional(),
  rateLimits: optString,
});

const externalApiExtra = z.object({
  protocol: z.enum(['rest', 'graphql', 'grpc']).optional(),
  baseUrl: optString,
  retryPolicy: optString,
  idempotencyKey: optString,
  contractVersion: optString,
  circuitBreaker: optString,
});

const legacyExtra = z.object({
  protocol: optString,
  format: optString,
  notes: optString,
});

const customExtra = z.object({}).catchall(z.unknown());

const DESCRIPTORS: Readonly<Record<IntegrationCategory, CategoryDescriptor>> = {
  bpms: {
    category: 'bpms',
    title: 'BPMS / workflow engine',
    hasDiagram: true,
    extraSchema: bpmsExtra,
  },
  'message-broker': {
    category: 'message-broker',
    title: 'Message broker',
    hasDiagram: true,
    extraSchema: messageBrokerExtra,
  },
  database: {
    category: 'database',
    title: 'Database',
    hasDiagram: true,
    extraSchema: databaseExtra,
  },
  cache: {
    category: 'cache',
    title: 'Cache',
    hasDiagram: false,
    extraSchema: cacheExtra,
  },
  search: {
    category: 'search',
    title: 'Search',
    hasDiagram: false,
    extraSchema: searchExtra,
  },
  identity: {
    category: 'identity',
    title: 'Identity provider',
    hasDiagram: false,
    extraSchema: identityExtra,
  },
  storage: {
    category: 'storage',
    title: 'Object storage',
    hasDiagram: false,
    extraSchema: storageExtra,
  },
  observability: {
    category: 'observability',
    title: 'Observability stack',
    hasDiagram: false,
    extraSchema: observabilityExtra,
  },
  payment: {
    category: 'payment',
    title: 'Payment provider',
    hasDiagram: false,
    extraSchema: paymentExtra,
  },
  notification: {
    category: 'notification',
    title: 'Notification provider',
    hasDiagram: false,
    extraSchema: notificationExtra,
  },
  'external-api': {
    category: 'external-api',
    title: 'External API',
    hasDiagram: false,
    extraSchema: externalApiExtra,
  },
  legacy: {
    category: 'legacy',
    title: 'Legacy system',
    hasDiagram: false,
    extraSchema: legacyExtra,
  },
  custom: {
    category: 'custom',
    title: 'Custom integration',
    hasDiagram: false,
    extraSchema: customExtra,
  },
};

export class IntegrationCategoryRegistry {
  public list(): readonly CategoryDescriptor[] {
    return Object.values(DESCRIPTORS);
  }

  public get(category: IntegrationCategory): CategoryDescriptor {
    return DESCRIPTORS[category];
  }

  public hasDiagram(category: IntegrationCategory): boolean {
    return DESCRIPTORS[category].hasDiagram;
  }

  public validateExtra(
    category: IntegrationCategory,
    extra: Readonly<Record<string, unknown>> | undefined,
  ): Readonly<Record<string, unknown>> {
    if (extra === undefined) {
      return {};
    }
    return DESCRIPTORS[category].extraSchema.parse(extra);
  }
}
