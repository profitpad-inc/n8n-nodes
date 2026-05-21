import { IExecuteFunctions, JsonObject } from 'n8n-workflow';

// Eclipse requires a session token obtained from POST /Sessions before any
// other API call. This pre-auth step cannot go through httpRequestWithAuthentication
// because the token is not a static credential — it is created on demand here.
// Retries up to 2 times with a 500 ms delay to handle intermittent 500s from the API.
export async function createSession(
  context: IExecuteFunctions,
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await context.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl}/Sessions`,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: { username, password },
        json: true,
      });
      return response.sessionToken as string;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function applyFieldFilter(
  results: JsonObject[],
  fieldsFilterMode: string,
  fieldsToInclude: string,
  fieldsToExclude: string,
): JsonObject[] {
  if (fieldsFilterMode === 'selected') {
    const fields = new Set(
      fieldsToInclude.split(',').map((f) => f.trim()).filter(Boolean),
    );
    fields.add('id');
    const copyPath = (src: unknown, dst: JsonObject, parts: string[]): void => {
      if (parts.length === 0 || src == null || Array.isArray(src) || typeof src !== 'object') return;
      const [head, ...tail] = parts;
      const srcVal = (src as JsonObject)[head];
      if (tail.length === 0) {
        if (srcVal !== undefined) dst[head] = srcVal as JsonObject[string];
        return;
      }
      if (Array.isArray(srcVal)) {
        if (!Array.isArray(dst[head])) {
          dst[head] = (srcVal as unknown[]).map(() => ({} as JsonObject)) as unknown as JsonObject[string];
        }
        (srcVal as unknown[]).forEach((item, idx) => {
          copyPath(item, (dst[head] as unknown as JsonObject[])[idx], tail);
        });
      } else if (srcVal != null && typeof srcVal === 'object') {
        if (typeof dst[head] !== 'object' || dst[head] === null) dst[head] = {};
        copyPath(srcVal, dst[head] as JsonObject, tail);
      }
    };
    return results.map((r) => {
      const out: JsonObject = {};
      for (const f of fields) copyPath(r, out, f.split('.'));
      return out;
    });
  }
  if (fieldsFilterMode === 'except') {
    const excluded = new Set(
      fieldsToExclude.split(',').map((f) => f.trim()).filter(Boolean),
    );
    excluded.delete('id');
    return results.map((r) => {
      const out: JsonObject = {};
      for (const [k, v] of Object.entries(r)) if (!excluded.has(k)) out[k] = v;
      return out;
    });
  }
  return results;
}
