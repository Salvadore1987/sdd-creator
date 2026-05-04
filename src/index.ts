// Domain models & types
export * from './domain/models';
export { IdGenerator } from './domain/IdGenerator';
export { ConfigManager } from './domain/ConfigManager';
export { IntegrationCatalog } from './domain/IntegrationCatalog';
export { IntegrationCategoryRegistry } from './domain/IntegrationCategoryRegistry';
export { CompletenessLinter } from './domain/CompletenessLinter';
export type { LintFinding, LintReport } from './domain/CompletenessLinter';
export { MermaidValidator } from './domain/MermaidValidator';
export { MermaidDiagramBuilder } from './domain/MermaidDiagramBuilder';
export { Migrator } from './domain/Migrator';
export { PromptBuilder } from './domain/PromptBuilder';
export { PromptLoader } from './domain/PromptLoader';
export { RequirementValidator } from './domain/RequirementValidator';
export { RequirementsMerger } from './domain/RequirementsMerger';
export { StatusTracker } from './domain/StatusTracker';

// Application services
export { BrainstormService } from './application/BrainstormService';
export { InitService, InitAlreadyExistsError } from './application/InitService';
export type { InitInput, InitResult, IdempotencyMode } from './application/InitService';
export { IntegrationsService } from './application/IntegrationsService';
export { LintService } from './application/LintService';
export { RequirementsItemService } from './application/RequirementsItemService';
export { SpecService } from './application/SpecService';
export type { DiagramKind, SpecGenerateOptions, SpecResult } from './application/SpecService';
export { StatusService } from './application/StatusService';

// Adapters
export { FileRepository } from './adapters/FileRepository';
export { HandlebarsTemplateEngine } from './adapters/HandlebarsTemplateEngine';
export { WinstonLogger } from './adapters/WinstonLogger';
export { ClaudeApiAdapter } from './adapters/ClaudeApiAdapter';
export { ClaudeCliAdapter } from './adapters/ClaudeCliAdapter';
export { ClaudeCliProbe } from './adapters/ClaudeCliProbe';
export { ClaudeProviderFactory } from './adapters/ClaudeProviderFactory';
export { CachingClaudeProvider } from './adapters/CachingClaudeProvider';

// Ports + port errors
export type { IFileRepository } from './ports/IFileRepository';
export type { IClaudeProvider, ClaudeCompleteOptions } from './ports/IClaudeProvider';
export type { ILogger, LogLevel, LogFields } from './ports/ILogger';
export type { ITemplateEngine, TemplateContext, TemplateHelper } from './ports/ITemplateEngine';
export type { IIntegrationImporter, ImportFormat } from './ports/IIntegrationImporter';
export type { IClaudeCliProbe, ClaudeCliProbeResult } from './ports/IClaudeCliProbe';
export {
  FileNotFoundError,
  PermissionError,
  ClaudeProviderError,
  ClaudeCliNotInstalledError,
  ClaudeCliAuthError,
  ClaudeApiAuthError,
  JsonParseError,
} from './ports/errors';

// CLI error / exit code surface
export {
  EXIT_CODES,
  SddCliError,
  ValidationError,
  LintFailedError,
  ProviderInvocationError,
  FileSystemError,
  classifyError,
} from './cli/errors';
export type { ExitCode, ClassifiedError } from './cli/errors';
export { handleCliError } from './cli/handler';
export type { HandleCliErrorOptions } from './cli/handler';
