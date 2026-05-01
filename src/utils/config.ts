import { promises as fs } from 'fs';
import * as path from 'path';

import { ENV_KEYS } from './constants';

export type EnvSource = Readonly<Record<string, string | undefined>>;

export async function loadDotEnv(filePath: string): Promise<Record<string, string>> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return {};
  }
  return parseDotEnv(raw);
}

export function parseDotEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key !== '') {
      out[key] = value;
    }
  }
  return out;
}

export function applyEnvDefaults(env: EnvSource, defaults: Record<string, string>): EnvSource {
  const merged: Record<string, string | undefined> = { ...defaults, ...env };
  return merged;
}

export function pickEnv(env: EnvSource): {
  claudeProvider: string | undefined;
  claudeCliBin: string | undefined;
  claudeCliTimeoutMs: string | undefined;
  claudeModel: string | undefined;
  anthropicApiKey: string | undefined;
  anthropicBaseUrl: string | undefined;
  logLevel: string | undefined;
  cacheDir: string | undefined;
  templatesDir: string | undefined;
} {
  return {
    claudeProvider: env[ENV_KEYS.claudeProvider],
    claudeCliBin: env[ENV_KEYS.claudeCliBin],
    claudeCliTimeoutMs: env[ENV_KEYS.claudeCliTimeoutMs],
    claudeModel: env[ENV_KEYS.claudeModel],
    anthropicApiKey: env[ENV_KEYS.anthropicApiKey],
    anthropicBaseUrl: env[ENV_KEYS.anthropicBaseUrl],
    logLevel: env[ENV_KEYS.logLevel],
    cacheDir: env[ENV_KEYS.cacheDir],
    templatesDir: env[ENV_KEYS.templatesDir],
  };
}

export function resolveCwdRelative(cwd: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}
