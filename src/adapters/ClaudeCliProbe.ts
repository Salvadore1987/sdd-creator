import { execFile } from 'child_process';
import { promisify } from 'util';

import type { IClaudeCliProbe, ClaudeCliProbeResult } from '../ports/IClaudeCliProbe';
import { DEFAULTS } from '../utils/constants';

const execFileAsync = promisify(execFile);

interface NodeIoError {
  code?: string;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
}

function isNodeIoError(value: unknown): value is NodeIoError {
  return typeof value === 'object' && value !== null;
}

function asString(value: string | Buffer | undefined): string {
  if (value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : value.toString('utf8');
}

export interface ClaudeCliProbeOptions {
  readonly bin?: string;
  readonly timeoutMs?: number;
}

export class ClaudeCliProbe implements IClaudeCliProbe {
  private readonly bin: string;
  private readonly timeoutMs: number;

  public constructor(options: ClaudeCliProbeOptions = {}) {
    this.bin = options.bin ?? DEFAULTS.claudeCliBin;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  public async probe(): Promise<ClaudeCliProbeResult> {
    try {
      const { stdout, stderr } = await execFileAsync(this.bin, ['--version'], {
        timeout: this.timeoutMs,
        shell: false,
      });
      const out = `${asString(stdout)}\n${asString(stderr)}`.trim();
      if (this.looksUnauthenticated(out)) {
        return {
          installed: true,
          authenticated: false,
          hint: 'Run `claude login` to authenticate.',
        };
      }
      return {
        installed: true,
        authenticated: true,
        version: out.split('\n')[0]?.trim() ?? '',
      };
    } catch (error) {
      if (isNodeIoError(error)) {
        const stderrText = asString(error.stderr);
        if (this.looksUnauthenticated(stderrText)) {
          return {
            installed: true,
            authenticated: false,
            hint: 'Run `claude login` to authenticate.',
          };
        }
        if (error.code === 'ENOENT') {
          return {
            installed: false,
            authenticated: false,
            hint: `Claude CLI not found at "${this.bin}". Install: npm i -g @anthropic-ai/claude-code`,
          };
        }
      }
      return {
        installed: false,
        authenticated: false,
        hint: `Could not probe Claude CLI ("${this.bin}"). Install: npm i -g @anthropic-ai/claude-code`,
      };
    }
  }

  private looksUnauthenticated(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('claude login') ||
      lower.includes('not authenticated') ||
      lower.includes('unauthorized') ||
      lower.includes('please log in')
    );
  }
}
