import type { Integration } from '../../domain/models';
import type { IIntegrationImporter, ImportFormat } from '../../ports/IIntegrationImporter';

export class BpmnImporter implements IIntegrationImporter {
  public readonly format: ImportFormat = 'bpmn';

  public canImport(format: string): boolean {
    return format === this.format;
  }

  public import(_filePath: string): Promise<readonly Integration[]> {
    throw new Error('BpmnImporter not implemented (Phase 4.5.3)');
  }
}
