import winston from 'winston';

import type { ILogger, LogFields, LogLevel } from '../ports/ILogger';
import { ENV_KEYS } from '../utils/constants';

const REDACT_KEYS: readonly string[] = [
  'prompt',
  'system',
  'apiKey',
  'api_key',
  'authorization',
  'token',
];
const REDACT_ENV_KEYS: readonly string[] = [ENV_KEYS.anthropicApiKey];

export interface WinstonLoggerOptions {
  readonly level?: LogLevel;
  readonly bindings?: LogFields;
}

export class WinstonLogger implements ILogger {
  private readonly logger: winston.Logger;
  private readonly bindings: LogFields;

  public constructor(options: WinstonLoggerOptions = {}, base?: winston.Logger) {
    this.bindings = options.bindings ?? {};
    this.logger =
      base ??
      winston.createLogger({
        level: options.level ?? 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf(formatMessage),
        ),
        transports: [new winston.transports.Console({ stderrLevels: ['error'] })],
      });
  }

  public debug(message: string, fields?: LogFields): void {
    this.logger.debug(message, this.merge(fields));
  }

  public info(message: string, fields?: LogFields): void {
    this.logger.info(message, this.merge(fields));
  }

  public warn(message: string, fields?: LogFields): void {
    this.logger.warn(message, this.merge(fields));
  }

  public error(message: string, fields?: LogFields): void {
    this.logger.error(message, this.merge(fields));
  }

  public child(bindings: LogFields): ILogger {
    return new WinstonLogger({ bindings: { ...this.bindings, ...bindings } }, this.logger);
  }

  private merge(fields: LogFields | undefined): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...this.bindings, ...(fields ?? {}) };
    return redact(merged);
  }
}

function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACT_KEYS.includes(key) || REDACT_ENV_KEYS.includes(key)) {
      out[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redact(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function formatMessage(info: winston.Logform.TransformableInfo): string {
  const { level, message, timestamp, ...rest } = info as Record<string, unknown> & {
    level: string;
    message: unknown;
    timestamp?: string;
  };
  const ts = typeof timestamp === 'string' ? timestamp : new Date().toISOString();
  const payload = { ts, level, message, ...rest };
  return JSON.stringify(payload);
}
