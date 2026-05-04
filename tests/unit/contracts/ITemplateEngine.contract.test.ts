import { HandlebarsTemplateEngine } from '../../../src/adapters/HandlebarsTemplateEngine';
import type { ITemplateEngine } from '../../../src/ports/ITemplateEngine';

const factories: Array<{ name: string; create: () => ITemplateEngine }> = [
  { name: 'HandlebarsTemplateEngine', create: () => new HandlebarsTemplateEngine() },
];

describe.each(factories)('ITemplateEngine contract — $name', ({ create }) => {
  it('renders a literal template unchanged when no expressions are present', () => {
    // arrange
    const engine = create();

    // act
    const out = engine.render('hello world', {});

    // assert
    expect(out).toBe('hello world');
  });

  it('substitutes context values into the template', () => {
    // arrange
    const engine = create();

    // act
    const out = engine.render('Hello, {{name}}!', { name: 'Alice' });

    // assert
    expect(out).toContain('Alice');
  });

  it('registerHelper exposes a custom helper to subsequent renders', () => {
    // arrange
    const engine = create();
    engine.registerHelper('shout', (value: unknown) => `${String(value)}!!!`);

    // act
    const out = engine.render('{{shout msg}}', { msg: 'go' });

    // assert
    expect(out).toBe('go!!!');
  });

  it('registerPartial allows a template to include another by name', () => {
    // arrange
    const engine = create();
    engine.registerPartial('greeting', 'Hi, {{name}}.');

    // act
    const out = engine.render('{{> greeting}}', { name: 'Bob' });

    // assert
    expect(out).toContain('Bob');
  });

  it('returns the same string twice for the same template+context (deterministic)', () => {
    // arrange
    const engine = create();

    // act
    const a = engine.render('answer is {{x}}', { x: 42 });
    const b = engine.render('answer is {{x}}', { x: 42 });

    // assert
    expect(a).toBe(b);
  });
});
