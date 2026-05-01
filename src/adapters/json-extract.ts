import type { ZodType } from 'zod';

import { JsonParseError } from '../ports/errors';

export function extractJson(raw: string): string {
  const fenced = matchFenced(raw);
  if (fenced !== null) {
    return fenced;
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw.trim();
}

export function parseJsonWithSchema<T>(raw: string, schema: ZodType<T>): T {
  const candidate = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new JsonParseError(`Failed to parse JSON: ${message}`, raw);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new JsonParseError(`Schema validation failed: ${result.error.message}`, raw);
  }
  return result.data;
}

function matchFenced(raw: string): string | null {
  const match = /```(?:json)?\s*([\s\S]*?)```/m.exec(raw);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return null;
}
