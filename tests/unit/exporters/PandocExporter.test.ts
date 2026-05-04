import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  PandocExporter,
  PandocNotInstalledError,
} from '../../../src/adapters/exporters/PandocExporter';

describe('PandocExporter', () => {
  it('translates ENOENT from a missing binary into PandocNotInstalledError', async () => {
    // arrange — point at a binary that definitely does not exist
    const exporter = new PandocExporter('html', '/no/such/pandoc-binary-xyz');
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-pandoc-'));
    const outFile = path.join(outDir, 'out.html');

    try {
      // act
      const promise = exporter.export({ markdown: '# Hi', outputPath: outFile });

      // assert
      await expect(promise).rejects.toBeInstanceOf(PandocNotInstalledError);
    } finally {
      await fs.rm(outDir, { recursive: true, force: true });
    }
  });

  it('exposes the chosen format for both html and pdf modes', () => {
    // arrange + act
    const html = new PandocExporter('html');
    const pdf = new PandocExporter('pdf');

    // assert
    expect(html.format).toBe('html');
    expect(pdf.format).toBe('pdf');
  });

  it('PandocNotInstalledError carries the missing binary path', () => {
    // arrange + act
    const err = new PandocNotInstalledError('/no/pandoc');

    // assert
    expect(err.name).toBe('PandocNotInstalledError');
    expect(err.bin).toBe('/no/pandoc');
    expect(err.message).toContain('pandoc');
  });
});
