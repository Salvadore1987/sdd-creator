export interface ClaudeCliProbeResult {
  readonly installed: boolean;
  readonly authenticated: boolean;
  readonly version?: string;
  readonly hint?: string;
}

export interface IClaudeCliProbe {
  probe(): Promise<ClaudeCliProbeResult>;
}
