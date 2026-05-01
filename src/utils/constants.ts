export const ENV_KEYS = {
  claudeProvider: 'SDD_CLAUDE_PROVIDER',
  claudeCliBin: 'SDD_CLAUDE_CLI_BIN',
  claudeCliTimeoutMs: 'SDD_CLAUDE_CLI_TIMEOUT_MS',
  claudeModel: 'SDD_CLAUDE_MODEL',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  anthropicBaseUrl: 'ANTHROPIC_BASE_URL',
  logLevel: 'LOG_LEVEL',
  cacheDir: 'SDD_GENERATOR_CACHE',
  templatesDir: 'SDD_GENERATOR_TEMPLATES_DIR',
} as const;

export const DEFAULTS = {
  claudeProvider: 'cli' as const,
  claudeCliBin: 'claude',
  claudeCliTimeoutMs: 120_000,
  claudeModel: 'claude-opus-4-7',
  claudeMaxTokens: 8_192,
  claudeTemperature: 0.2,
  logLevel: 'info' as const,
  cacheDir: '.sdd/cache',
  sddDir: '.sdd',
  configFile: '.sdd/config.json',
  requirementsFile: '.sdd/requirements.json',
  integrationsFile: '.sdd/integrations.json',
  outputSddFile: 'docs/SDD.md',
  outputIntegrationsFile: 'docs/INTEGRATIONS.md',
} as const;
