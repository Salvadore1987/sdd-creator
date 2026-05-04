export type ExportFormat = 'html' | 'pdf' | 'confluence';

export interface SpecExportInput {
  readonly markdown: string;
  readonly outputPath: string;
  readonly title?: string;
}

export interface ISpecExporter {
  readonly format: ExportFormat;
  export(input: SpecExportInput): Promise<{ readonly outputPath: string }>;
}
