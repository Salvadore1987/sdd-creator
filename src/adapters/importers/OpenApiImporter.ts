import type { Integration } from '../../domain/models';
import type { IFileRepository } from '../../ports/IFileRepository';
import type { IIntegrationImporter, ImportFormat } from '../../ports/IIntegrationImporter';

interface OpenApiInfo {
  title?: string;
  description?: string;
  version?: string;
}
interface OpenApiServer {
  url?: string;
  description?: string;
}
interface OpenApiPathItem {
  [method: string]: { summary?: string; operationId?: string } | undefined;
}
interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info?: OpenApiInfo;
  servers?: OpenApiServer[];
  paths?: Record<string, OpenApiPathItem>;
}

export class OpenApiImporter implements IIntegrationImporter {
  public readonly format: ImportFormat = 'openapi';
  public constructor(private readonly files: IFileRepository) {}

  public canImport(format: string): boolean {
    return format === this.format;
  }

  public async import(filePath: string): Promise<readonly Integration[]> {
    const raw = await this.files.read(filePath);
    const parsed = this.parse(raw);
    const title = parsed.info?.title ?? 'External API';
    const version = parsed.info?.version;
    const purpose = parsed.info?.description ?? `REST API imported from ${filePath}`;
    const endpoints = this.collectEndpoints(parsed);
    const operations = this.collectOperations(parsed);
    const integration: Integration = {
      id: 'INT-PENDING',
      category: 'external-api',
      name: title,
      purpose,
      endpoints,
      ...(version !== undefined ? { versioning: `OpenAPI ${parsed.openapi ?? parsed.swagger ?? ''} / ${version}` } : {}),
      extra: {
        protocol: 'rest',
        operations,
        sourceFile: filePath,
      },
    };
    return [integration];
  }

  private parse(raw: string): OpenApiDocument {
    try {
      return JSON.parse(raw) as OpenApiDocument;
    } catch (error) {
      throw new Error(
        `OpenApiImporter currently supports JSON OpenAPI specs only. ` +
          `Convert YAML to JSON first. Underlying error: ${(error as Error).message}`,
      );
    }
  }

  private collectEndpoints(doc: OpenApiDocument): Integration['endpoints'] {
    const servers = doc.servers ?? [];
    if (servers.length === 0) {
      return [{ name: 'default', protocol: 'http', url: '' }];
    }
    return servers.map((s, idx) => ({
      name: s.description ?? `server-${idx + 1}`,
      protocol: 'http',
      url: s.url ?? '',
    }));
  }

  private collectOperations(doc: OpenApiDocument): readonly string[] {
    const out: string[] = [];
    const paths = doc.paths ?? {};
    for (const [route, item] of Object.entries(paths)) {
      if (item === undefined) continue;
      for (const method of Object.keys(item)) {
        const operation = item[method];
        if (operation === undefined) continue;
        out.push(`${method.toUpperCase()} ${route}${operation.summary ? ` — ${operation.summary}` : ''}`);
      }
    }
    return out;
  }
}
