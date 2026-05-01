import { SCHEMA_VERSION } from '../../src/domain/models';
import type {
  Integration,
  ProjectConfig,
  RequirementsDocument,
  SectionState,
} from '../../src/domain/models';

export function makeSectionState(overrides: Partial<SectionState> = {}): SectionState {
  return { status: 'pending', ...overrides };
}

export function makeProjectConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  const now = '2026-05-01T00:00:00.000Z';
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: { name: 'demo' },
    stack: 'java',
    architecture: 'hexagonal',
    language: 'ru',
    technologies: ['Spring Boot 3'],
    claude: { provider: 'cli' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeRequirementsDocument(
  overrides: Partial<RequirementsDocument> = {},
): RequirementsDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    stakeholders: { state: makeSectionState(), items: [] },
    context: { state: makeSectionState() },
    constraints: { state: makeSectionState(), items: [] },
    glossary: { state: makeSectionState(), terms: [] },
    features: { state: makeSectionState(), items: [] },
    domain: { state: makeSectionState(), aggregates: [] },
    quality: { state: makeSectionState(), nfrs: [] },
    dependencies: { state: makeSectionState(), integrationRefs: [] },
    anti: { state: makeSectionState(), items: [] },
    compliance: { state: makeSectionState(), items: [] },
    adrs: [],
    risks: [],
    ...overrides,
  };
}

export function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'INT-001',
    category: 'message-broker',
    name: 'RabbitMQ',
    purpose: 'event delivery',
    endpoints: [{ name: 'amqp', protocol: 'amqp' }],
    ...overrides,
  };
}
