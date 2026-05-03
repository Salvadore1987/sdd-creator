import * as path from 'path';

import type { Integration } from '../../domain/models';
import type { IFileRepository } from '../../ports/IFileRepository';
import type { IIntegrationImporter, ImportFormat } from '../../ports/IIntegrationImporter';

export class BpmnImporter implements IIntegrationImporter {
  public readonly format: ImportFormat = 'bpmn';
  public constructor(private readonly files: IFileRepository) {}

  public canImport(format: string): boolean {
    return format === this.format;
  }

  public async import(filePath: string): Promise<readonly Integration[]> {
    const raw = await this.files.read(filePath);
    const processes = this.extractAttribute(raw, /<bpmn[^:>]*:process\b[^>]*\bid="([^"]+)"/g);
    const userTasks = this.extractAttribute(raw, /<bpmn[^:>]*:userTask\b[^>]*\bname="([^"]+)"/g);
    const serviceTasks = this.extractAttribute(raw, /<bpmn[^:>]*:serviceTask\b[^>]*\bname="([^"]+)"/g);
    const events = this.extractAttribute(raw, /<bpmn[^:>]*:(?:start|intermediate|end)Event\b[^>]*\bname="([^"]+)"/g);

    const baseName = path.basename(filePath).replace(/\.bpmn$/i, '');
    const integration: Integration = {
      id: 'INT-PENDING',
      category: 'bpms',
      name: processes[0] ?? baseName,
      purpose: `BPMN process imported from ${filePath}`,
      endpoints: [{ name: 'engine', protocol: 'bpmn' }],
      extra: {
        engine: 'unknown',
        processes,
        jobWorkers: serviceTasks,
        correlationKeys: events,
        sagas: userTasks,
        bpmnFile: filePath,
        sourceFile: filePath,
      },
    };
    return [integration];
  }

  private extractAttribute(xml: string, regex: RegExp): string[] {
    const out: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      if (match[1] !== undefined) {
        out.push(match[1]);
      }
    }
    return out;
  }
}
