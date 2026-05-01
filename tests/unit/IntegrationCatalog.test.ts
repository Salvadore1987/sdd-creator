import { IntegrationCatalog } from '../../src/domain/IntegrationCatalog';
import { SCHEMA_VERSION } from '../../src/domain/models';

describe('IntegrationCatalog', () => {
  it('assigns sequential INT-NNN ids on add', () => {
    // arrange
    const catalog = new IntegrationCatalog();

    // act
    const a = catalog.add({
      category: 'message-broker',
      name: 'RabbitMQ',
      purpose: 'events',
      endpoints: [{ name: 'amqp' }],
    });
    const b = catalog.add({
      category: 'database',
      name: 'PostgreSQL',
      purpose: 'storage',
      endpoints: [{ name: 'jdbc' }],
    });

    // assert
    expect(a.id).toBe('INT-001');
    expect(b.id).toBe('INT-002');
  });

  it('updates an existing integration in place', () => {
    // arrange
    const catalog = new IntegrationCatalog();
    const created = catalog.add({
      category: 'cache',
      name: 'Redis',
      purpose: 'cache',
      endpoints: [{ name: 'redis' }],
    });

    // act
    const updated = catalog.update(created.id, { vendor: 'Redis Labs' });

    // assert
    expect(updated.vendor).toBe('Redis Labs');
    expect(updated.id).toBe(created.id);
  });

  it('throws when removing missing id', () => {
    // arrange
    const catalog = new IntegrationCatalog();

    // act
    const fn = (): void => {
      catalog.remove('INT-999');
    };

    // assert
    expect(fn).toThrow(/INT-999/);
  });

  it('exports a valid IntegrationsDocument', () => {
    // arrange
    const catalog = new IntegrationCatalog();
    catalog.add({
      category: 'identity',
      name: 'Keycloak',
      purpose: 'auth',
      endpoints: [{ name: 'oidc' }],
    });

    // act
    const doc = catalog.toDocument();

    // assert
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.integrations).toHaveLength(1);
  });

  it('loads from a serialized document and resumes id generation', () => {
    // arrange
    const catalog = new IntegrationCatalog();
    catalog.load({
      schemaVersion: SCHEMA_VERSION,
      integrations: [
        {
          id: 'INT-005',
          category: 'cache',
          name: 'Redis',
          purpose: 'cache',
          endpoints: [{ name: 'redis' }],
        },
      ],
    });

    // act
    const next = catalog.add({
      category: 'cache',
      name: 'Memcached',
      purpose: 'cache',
      endpoints: [{ name: 'memcached' }],
    });

    // assert
    expect(next.id).toBe('INT-006');
  });
});
