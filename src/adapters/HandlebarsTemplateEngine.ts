import Handlebars from 'handlebars';

import type {
  ITemplateEngine,
  TemplateContext,
  TemplateHelper,
} from '../ports/ITemplateEngine';

type CompiledTemplate = (context: unknown) => string;

export class HandlebarsTemplateEngine implements ITemplateEngine {
  private readonly env: typeof Handlebars;
  private readonly compiledCache = new Map<string, CompiledTemplate>();

  public constructor() {
    this.env = Handlebars.create();
    this.registerBuiltInHelpers();
  }

  public render(template: string, context: TemplateContext): string {
    const compiled = this.compile(template);
    return compiled(context);
  }

  public registerHelper(name: string, helper: TemplateHelper): void {
    this.env.registerHelper(name, helper as Handlebars.HelperDelegate);
  }

  public registerPartial(name: string, source: string): void {
    this.env.registerPartial(name, source);
  }

  private compile(template: string): CompiledTemplate {
    const cached = this.compiledCache.get(template);
    if (cached !== undefined) {
      return cached;
    }
    const compiled = this.env.compile(template, { noEscape: true, strict: false });
    this.compiledCache.set(template, compiled);
    return compiled;
  }

  private registerBuiltInHelpers(): void {
    this.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    this.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
    this.registerHelper('lower', (value: unknown) => safeString(value).toLowerCase());
    this.registerHelper('upper', (value: unknown) => safeString(value).toUpperCase());
    this.registerHelper('join', (...args: unknown[]) => {
      const parts = args.slice(0, -1);
      const list = parts[0];
      const sep = typeof parts[1] === 'string' ? parts[1] : ', ';
      return Array.isArray(list) ? list.join(sep) : '';
    });
    this.registerHelper('formatDate', (value: unknown) => {
      if (typeof value !== 'string') {
        return '';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toISOString().slice(0, 10);
    });
    this.registerHelper('mermaidEscape', (value: unknown) => {
      if (typeof value !== 'string') {
        return '';
      }
      return value.replace(/[`"]/g, '\\$&').replace(/\n/g, ' ');
    });
    this.registerHelper('markdownTable', (rows: unknown, headers: unknown) => {
      if (!Array.isArray(rows) || !Array.isArray(headers)) {
        return '';
      }
      const head = `| ${headers.map(String).join(' | ')} |`;
      const sep = `| ${headers.map(() => '---').join(' | ')} |`;
      const body = rows
        .map((row) => {
          const cells = Array.isArray(row) ? row : headers.map(() => '');
          return `| ${cells.map(toCell).join(' | ')} |`;
        })
        .join('\n');
      return [head, sep, body].join('\n');
    });
  }
}

function toCell(value: unknown): string {
  return safeString(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
