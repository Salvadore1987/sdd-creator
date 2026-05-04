import type { ExportFormat, ISpecExporter, SpecExportInput } from '../../ports/ISpecExporter';

export class ConfluenceExporter implements ISpecExporter {
  public readonly format: ExportFormat = 'confluence';

  public export(_input: SpecExportInput): Promise<{ outputPath: string }> {
    return Promise.reject<{ outputPath: string }>(
      new Error(
        'Confluence export is not yet implemented in v1.0.0. Configure a webhook or use the pdf/html format meanwhile.',
      ),
    );
  }
}
