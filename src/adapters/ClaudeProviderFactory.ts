import type { ClaudeProviderKind } from '../domain/models';
import { ClaudeApiAuthError } from '../ports/errors';
import type { IClaudeProvider } from '../ports/IClaudeProvider';
import type { ILogger } from '../ports/ILogger';
import { DEFAULTS } from '../utils/constants';

import { ClaudeApiAdapter } from './ClaudeApiAdapter';
import { ClaudeCliAdapter } from './ClaudeCliAdapter';

export interface ClaudeProviderFactoryInputs {
  readonly flag?: string;
  readonly env?: string;
  readonly configValue?: ClaudeProviderKind;
}

export interface ClaudeProviderEnvInputs {
  readonly anthropicApiKey?: string;
  readonly anthropicBaseUrl?: string;
  readonly cliBin?: string;
  readonly cliTimeoutMs?: number;
  readonly model?: string;
}

export class ClaudeProviderFactory {
  public constructor(private readonly logger: ILogger) {}

  public resolveKind(inputs: ClaudeProviderFactoryInputs): ClaudeProviderKind {
    const candidates: readonly (string | undefined)[] = [
      inputs.flag,
      inputs.env,
      inputs.configValue,
    ];
    for (const candidate of candidates) {
      if (candidate === 'cli' || candidate === 'api') {
        return candidate;
      }
    }
    return DEFAULTS.claudeProvider;
  }

  public create(kind: ClaudeProviderKind, env: ClaudeProviderEnvInputs): IClaudeProvider {
    if (kind === 'api') {
      const apiKey = env.anthropicApiKey;
      if (apiKey === undefined || apiKey.trim() === '') {
        throw new ClaudeApiAuthError();
      }
      return new ClaudeApiAdapter(
        {
          apiKey,
          ...(env.anthropicBaseUrl !== undefined ? { baseUrl: env.anthropicBaseUrl } : {}),
          ...(env.model !== undefined ? { defaultModel: env.model } : {}),
        },
        this.logger,
      );
    }
    return new ClaudeCliAdapter(
      {
        ...(env.cliBin !== undefined ? { bin: env.cliBin } : {}),
        ...(env.cliTimeoutMs !== undefined ? { timeoutMs: env.cliTimeoutMs } : {}),
        ...(env.model !== undefined ? { defaultModel: env.model } : {}),
      },
      this.logger,
    );
  }
}
