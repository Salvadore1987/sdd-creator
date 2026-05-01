import type { Integration } from '../../domain/models';
import type { IIntegrationImporter, ImportFormat } from '../../ports/IIntegrationImporter';

export class AsyncApiImporter implements IIntegrationImporter {
  public readonly format: ImportFormat = 'asyncapi';

  public canImport(format: string): boolean {
    return format === this.format;
  }

  public import(_filePath: string): Promise<readonly Integration[]> {
    throw new Error('AsyncApiImporter not implemented (Phase 4.5.3)');
  }
}
