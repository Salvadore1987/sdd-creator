import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

import type { ExportFormat, ISpecExporter, SpecExportInput } from '../../ports/ISpecExporter';

const execFileAsync = promisify(execFile);

export class PandocNotInstalledError extends Error {
  public constructor(public readonly bin: string) {
    super(
      `${bin} is not installed or not found in PATH. Install pandoc (https://pandoc.org/installing.html) to export PDF/HTML.`,
    );
    this.name = 'PandocNotInstalledError';
  }
}

export class PandocExporter implements ISpecExporter {
  public readonly format: ExportFormat;

  public constructor(format: 'html' | 'pdf', private readonly bin: string = 'pandoc') {
    this.format = format;
  }

  public async export(input: SpecExportInput): Promise<{ outputPath: string }> {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-export-'));
    const inputFile = path.join(tmp, 'input.md');
    await fs.writeFile(inputFile, input.markdown, 'utf8');
    await fs.mkdir(path.dirname(input.outputPath), { recursive: true });

    const args = ['-f', 'gfm', '-o', input.outputPath, inputFile];
    if (this.format === 'pdf') {
      args.unshift('--pdf-engine=wkhtmltopdf');
    } else {
      args.unshift('-t', 'html5', '--standalone');
    }

    try {
      await execFileAsync(this.bin, args, { timeout: 120_000 });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new PandocNotInstalledError(this.bin);
      }
      throw error;
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }

    return { outputPath: input.outputPath };
  }
}
