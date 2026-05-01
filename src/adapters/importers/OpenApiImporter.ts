import type { Integration } from '../../domain/models';
import type { IIntegrationImporter, ImportFormat } from '../../ports/IIntegrationImporter';

export class OpenApiImporter implements IIntegrationImporter {
  public readonly format: ImportFormat = 'openapi';

  public canImport(format: string): boolean {
    return format === this.format;
  }

  public import(_filePath: string): Promise<readonly Integration[]> {
    throw new Error('OpenApiImporter not implemented (Phase 4.5.3)');
  }
}
