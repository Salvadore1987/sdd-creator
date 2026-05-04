export interface MermaidValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

const VALID_HEADERS: readonly RegExp[] = [
  /^graph\b/i,
  /^flowchart\b/i,
  /^sequenceDiagram\b/,
  /^classDiagram\b/,
  /^erDiagram\b/,
  /^stateDiagram(?:-v2)?\b/,
  /^gantt\b/,
  /^pie\b/,
  /^journey\b/,
  /^mindmap\b/,
  /^gitGraph\b/,
  /^C4Context\b/,
  /^C4Container\b/,
  /^C4Component\b/,
  /^C4Deployment\b/,
];

export class MermaidValidator {
  public validate(diagram: string): MermaidValidationResult {
    const trimmed = diagram.trim();
    if (trimmed === '') {
      return { valid: false, reason: 'empty diagram' };
    }
    const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
    if (!VALID_HEADERS.some((re) => re.test(firstLine))) {
      return { valid: false, reason: `unrecognized diagram header: "${firstLine.slice(0, 40)}"` };
    }
    const balance = this.checkBalanced(trimmed);
    if (!balance.valid) {
      return balance;
    }
    return { valid: true };
  }

  public extractFenced(markdown: string): readonly string[] {
    const out: string[] = [];
    const fenceRegex = /```mermaid\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(markdown)) !== null) {
      out.push(match[1] ?? '');
    }
    return out;
  }

  public sanitize(markdown: string): string {
    return markdown.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_match, body: string) => {
      const result = this.validate(body);
      if (result.valid) {
        return `\`\`\`mermaid\n${body.trim()}\n\`\`\``;
      }
      return `<!-- TODO: human review — invalid mermaid (${result.reason ?? 'unknown'}) -->\n\`\`\`\n${body.trim()}\n\`\`\``;
    });
  }

  private checkBalanced(text: string): MermaidValidationResult {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ];
    for (const [open, close] of pairs) {
      const opens = this.countChar(text, open);
      const closes = this.countChar(text, close);
      if (opens !== closes) {
        return {
          valid: false,
          reason: `unbalanced "${open}${close}" (${opens} vs ${closes})`,
        };
      }
    }
    return { valid: true };
  }

  private countChar(text: string, ch: string): number {
    let n = 0;
    for (const c of text) {
      if (c === ch) {
        n += 1;
      }
    }
    return n;
  }
}
