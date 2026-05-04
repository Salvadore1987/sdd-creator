import type { Integration } from '../../domain/models';
import type { IFileRepository } from '../../ports/IFileRepository';
import type { IIntegrationImporter, ImportFormat } from '../../ports/IIntegrationImporter';

interface AsyncApiServer {
  url?: string;
  protocol?: string;
  description?: string;
}
interface AsyncApiChannelOp {
  summary?: string;
  operationId?: string;
}
interface AsyncApiChannel {
  publish?: AsyncApiChannelOp;
  subscribe?: AsyncApiChannelOp;
  description?: string;
}
interface AsyncApiDocument {
  asyncapi?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: Record<string, AsyncApiServer>;
  channels?: Record<string, AsyncApiChannel>;
}

export class AsyncApiImporter implements IIntegrationImporter {
  public readonly format: ImportFormat = 'asyncapi';
  public constructor(private readonly files: IFileRepository) {}

  public canImport(format: string): boolean {
    return format === this.format;
  }

  public async import(filePath: string): Promise<readonly Integration[]> {
    const raw = await this.files.read(filePath);
    let parsed: AsyncApiDocument;
    try {
      parsed = JSON.parse(raw) as AsyncApiDocument;
    } catch (error) {
      throw new Error(
        `AsyncApiImporter currently supports JSON AsyncAPI specs only. ` +
          `Convert YAML to JSON first. Underlying error: ${(error as Error).message}`,
      );
    }

    const title = parsed.info?.title ?? 'Message broker';
    const purpose = parsed.info?.description ?? `Async API imported from ${filePath}`;
    const servers = Object.entries(parsed.servers ?? {});
    const endpoints =
      servers.length === 0
        ? [{ name: 'default', protocol: 'amqp', url: '' }]
        : servers.map(([name, s]) => ({
            name,
            protocol: s.protocol ?? 'unknown',
            url: s.url ?? '',
          }));
    const flavor = (servers[0]?.[1]?.protocol ?? '').toLowerCase();
    const topics: string[] = [];
    const consumerGroups: string[] = [];
    for (const [channel, def] of Object.entries(parsed.channels ?? {})) {
      topics.push(channel);
      if (def.subscribe?.operationId !== undefined) {
        consumerGroups.push(def.subscribe.operationId);
      }
    }
    const integration: Integration = {
      id: 'INT-PENDING',
      category: 'message-broker',
      name: title,
      purpose,
      endpoints,
      ...(parsed.info?.version !== undefined
        ? { versioning: `AsyncAPI ${parsed.asyncapi ?? ''} / ${parsed.info.version}` }
        : {}),
      extra: {
        flavor,
        topics,
        consumerGroups,
        sourceFile: filePath,
      },
    };
    return [integration];
  }
}
