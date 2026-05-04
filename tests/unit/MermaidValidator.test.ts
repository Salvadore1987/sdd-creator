import { MermaidValidator } from '../../src/domain/MermaidValidator';

describe('MermaidValidator', () => {
  it('accepts a well-formed flowchart', () => {
    // arrange
    const v = new MermaidValidator();

    // act
    const result = v.validate('flowchart LR\n  A[Start] --> B[End]');

    // assert
    expect(result.valid).toBe(true);
  });

  it('accepts C4Container header', () => {
    // arrange
    const v = new MermaidValidator();

    // act
    const result = v.validate('C4Container\n  Person(u, "User", "x")');

    // assert
    expect(result.valid).toBe(true);
  });

  it('rejects unknown header', () => {
    // arrange
    const v = new MermaidValidator();

    // act
    const result = v.validate('superGraph LR\n  A --> B');

    // assert
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('header');
  });

  it('rejects unbalanced brackets', () => {
    // arrange
    const v = new MermaidValidator();

    // act
    const result = v.validate('flowchart LR\n  A[Start --> B[End]');

    // assert
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('unbalanced');
  });

  it('rejects empty diagram', () => {
    // arrange
    const v = new MermaidValidator();

    // act
    const result = v.validate('   \n  ');

    // assert
    expect(result.valid).toBe(false);
  });

  it('extracts fenced mermaid blocks from markdown', () => {
    // arrange
    const v = new MermaidValidator();
    const md = '# Title\n\n```mermaid\nflowchart LR\nA-->B\n```\n\nText\n\n```mermaid\nsequenceDiagram\nA->>B: x\n```\n';

    // act
    const blocks = v.extractFenced(md);

    // assert
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('flowchart');
    expect(blocks[1]).toContain('sequenceDiagram');
  });

  it('annotates invalid mermaid blocks during sanitize', () => {
    // arrange
    const v = new MermaidValidator();
    const md = '```mermaid\nbogus syntax\n```';

    // act
    const sanitized = v.sanitize(md);

    // assert
    expect(sanitized).toContain('TODO: human review');
    expect(sanitized).not.toMatch(/```mermaid/);
  });

  it('keeps valid mermaid blocks during sanitize', () => {
    // arrange
    const v = new MermaidValidator();
    const md = '```mermaid\nflowchart LR\nA --> B\n```';

    // act
    const sanitized = v.sanitize(md);

    // assert
    expect(sanitized).toContain('```mermaid');
    expect(sanitized).not.toContain('TODO');
  });
});
