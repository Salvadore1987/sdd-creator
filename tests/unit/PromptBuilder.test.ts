import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import { PromptBuilder } from '../../src/domain/PromptBuilder';
import { makeProjectConfig, makeRequirementsDocument } from '../fixtures/builders';

describe('PromptBuilder', () => {
  it('exposes config and stack to the template', () => {
    // arrange
    const engine = new HandlebarsTemplateEngine();
    const builder = new PromptBuilder(engine);
    const template = 'Stack: {{stack}}, App: {{config.metadata.name}}';

    // act
    const out = builder.build(template, {
      config: makeProjectConfig({ metadata: { name: 'loan-service' } }),
      requirements: makeRequirementsDocument(),
    });

    // assert
    expect(out).toBe('Stack: java, App: loan-service');
  });

  it('passes through extra variables', () => {
    // arrange
    const engine = new HandlebarsTemplateEngine();
    const builder = new PromptBuilder(engine);

    // act
    const out = builder.build('Hi {{name}}', {
      config: makeProjectConfig(),
      requirements: makeRequirementsDocument(),
      extra: { name: 'Alice' },
    });

    // assert
    expect(out).toBe('Hi Alice');
  });
});
