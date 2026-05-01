export type TemplateContext = Readonly<Record<string, unknown>>;

export type TemplateHelper = (...args: readonly unknown[]) => unknown;

export interface ITemplateEngine {
  render(template: string, context: TemplateContext): string;
  registerHelper(name: string, helper: TemplateHelper): void;
  registerPartial(name: string, source: string): void;
}
