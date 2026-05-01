import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';

describe('HandlebarsTemplateEngine', () => {
  it('renders a basic template', () => {
    // arrange
    const engine = new HandlebarsTemplateEngine();

    // act
    const out = engine.render('Hello {{name}}', { name: 'World' });

    // assert
    expect(out).toBe('Hello World');
  });

  it('exposes lower/upper helpers', () => {
    // arrange
    const engine = new HandlebarsTemplateEngine();

    // act
    const lower = engine.render('{{lower s}}', { s: 'ABC' });
    const upper = engine.render('{{upper s}}', { s: 'abc' });

    // assert
    expect(lower).toBe('abc');
    expect(upper).toBe('ABC');
  });

  it('escapes mermaid-unfriendly chars', () => {
    // arrange
    const engine = new HandlebarsTemplateEngine();

    // act
    const out = engine.render('{{mermaidEscape s}}', { s: 'a "b" `c`\nd' });

    // assert
    expect(out).toContain('\\"');
    expect(out).toContain('\\`');
    expect(out).not.toContain('\n');
  });

  it('renders a markdown table', () => {
    // arrange
    const engine = new HandlebarsTemplateEngine();
    const ctx = {
      headers: ['ID', 'Title'],
      rows: [
        ['FR-001', 'Auth'],
        ['FR-002', 'Search'],
      ],
    };

    // act
    const out = engine.render('{{markdownTable rows headers}}', ctx);

    // assert
    expect(out).toContain('| ID | Title |');
    expect(out).toContain('| --- | --- |');
    expect(out).toContain('| FR-001 | Auth |');
  });
});
