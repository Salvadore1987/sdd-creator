import { ConfluenceExporter } from '../../../src/adapters/exporters/ConfluenceExporter';

describe('ConfluenceExporter', () => {
  it('declares the confluence export format', () => {
    // arrange + act
    const exporter = new ConfluenceExporter();

    // assert
    expect(exporter.format).toBe('confluence');
  });

  it('rejects with a clear "not yet implemented" message', async () => {
    // arrange
    const exporter = new ConfluenceExporter();

    // act
    const promise = exporter.export({
      markdown: '# X',
      outputPath: '/tmp/out.md',
    });

    // assert
    await expect(promise).rejects.toThrow(/not yet implemented/i);
  });
});
