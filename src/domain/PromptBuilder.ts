import type { ITemplateEngine, TemplateContext } from '../ports/ITemplateEngine';

import type { ProjectConfig, RequirementsDocument } from './models';

export interface PromptInputs {
  readonly config: ProjectConfig;
  readonly requirements: RequirementsDocument;
  readonly extra?: TemplateContext;
}

export class PromptBuilder {
  public constructor(private readonly engine: ITemplateEngine) {}

  public build(template: string, inputs: PromptInputs): string {
    const context: TemplateContext = {
      config: inputs.config,
      requirements: inputs.requirements,
      stack: inputs.config.stack,
      architecture: inputs.config.architecture,
      language: inputs.config.language,
      ...(inputs.extra ?? {}),
    };
    return this.engine.render(template, context);
  }
}
