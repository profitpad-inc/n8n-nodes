import { IExecuteFunctions, ILoadOptionsFunctions, JsonObject, NodeOperationError, sleep } from 'n8n-workflow';

// Waits between attempts in withRetry. Eclipse's intermittent 500s tend to
// clear within a few seconds, so retrying instantly (the old behavior) just
// hit the same failure three times in a row.
const RETRY_DELAYS_MS = [1000, 3000, 8000];

function errorStatus(error: unknown): number {
  const err = error as {
    httpCode?: string | number;
    response?: { status?: number };
    cause?: { response?: { status?: number } };
  };
  return Number(err?.response?.status ?? err?.cause?.response?.status ?? err?.httpCode);
}

// Only server-side and transport failures are worth retrying. 4xx responses
// (bad filters, inverted date windows, bad credentials) fail the same way
// every time, so they're thrown immediately.
function isRetryableError(error: unknown): boolean {
  const status = errorStatus(error);
  if (!Number.isFinite(status) || status === 0) return true;
  return status >= 500 || status === 429;
}

// `onRetry` runs before each retry attempt, e.g. to mint a fresh session
// token in case the failure was caused by a stale one.
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = RETRY_DELAYS_MS.length + 1,
  onRetry?: () => Promise<void>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // A 401 is retried only when onRetry can fix it, i.e. by logging in
      // again after a cached session token expired.
      const retryable = isRetryableError(error) || (onRetry !== undefined && errorStatus(error) === 401);
      if (attempt === maxAttempts || !retryable) break;
      await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
      if (onRetry) await onRetry();
    }
  }
  throw lastError;
}

// Eclipse requires a session token obtained from POST /Sessions before any
// other API call. This pre-auth step cannot go through httpRequestWithAuthentication
// because the token is not a static credential, it is created on demand here.
// Retried with backoff via withRetry to handle intermittent 500s from the API.
export async function createSession(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  try {
    const response = await withRetry(() =>
      context.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl}/Sessions`,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: { username, password },
        json: true,
      }),
    );
    return response.sessionToken as string;
  } catch (error) {
    throw sanitizeSessionError(context, error);
  }
}

// Session tokens are cached in memory per Eclipse login, so polling triggers
// reuse one token instead of logging in on every poll. Eclipse's login
// endpoint is the call that intermittently returns 500/504 or takes over a
// minute, so every skipped login is one less chance to fail. A token is
// replaced when a request using it fails (see getSession's forceRefresh) or
// after SESSION_MAX_AGE_MS as a safety net, since Eclipse's actual session
// lifetime isn't documented here.
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;
const sessionCache = new Map<string, { password: string; token: Promise<string>; createdAt: number }>();

export async function getSession(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  baseUrl: string,
  username: string,
  password: string,
  forceRefresh = false,
): Promise<string> {
  const key = `${baseUrl}|${username}`;
  const cached = sessionCache.get(key);
  if (
    !forceRefresh &&
    cached &&
    cached.password === password &&
    Date.now() - cached.createdAt < SESSION_MAX_AGE_MS
  ) {
    return await cached.token;
  }
  // Store the in-flight promise so triggers polling at the same moment share
  // one login instead of each starting their own.
  const token = createSession(context, baseUrl, username, password);
  const entry = { password, token, createdAt: Date.now() };
  sessionCache.set(key, entry);
  // A failed login must not stay cached. The rejection itself still reaches
  // the caller through `await token` below.
  token.catch(() => {
    if (sessionCache.get(key) === entry) sessionCache.delete(key);
  });
  return await token;
}

// Login failure error that also exposes the HTTP status as its own
// `httpCode` field. n8n serializes errors through toJSON() (execution data,
// error workflow input), and the base toJSON() only keeps message,
// description, context etc., so httpCode has to be added there explicitly.
// The name stays "NodeOperationError" so existing error handling that
// checks it isn't affected.
class EclipseLoginError extends NodeOperationError {
  httpCode: string | null;

  constructor(
    node: ReturnType<IExecuteFunctions['getNode']>,
    message: string,
    httpCode: string | null,
    description: string | undefined,
  ) {
    super(node, message, { description });
    this.name = 'NodeOperationError';
    this.httpCode = httpCode;
  }

  // Same fields as ExecutionBaseError.toJSON(), plus httpCode.
  toJSON() {
    return {
      message: this.message,
      lineNumber: this.lineNumber,
      timestamp: this.timestamp,
      name: this.name,
      description: this.description,
      context: this.context,
      cause: this.cause,
      httpCode: this.httpCode,
    };
  }
}

// httpRequest errors carry the full request config, including the
// { username, password } body, and n8n stores them as-is in execution data
// and passes them to error workflows. Rebuild the error from only the status
// and Eclipse's response body so the credentials never leave this function.
function sanitizeSessionError(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  error: unknown,
): NodeOperationError {
  const err = error as {
    message?: string;
    code?: string;
    response?: { status?: number; data?: unknown };
  };
  const status = err?.response?.status;
  const message = status
    ? `Eclipse login (POST /Sessions) failed with status code ${status}`
    : `Eclipse login (POST /Sessions) failed: ${err?.code ?? err?.message ?? 'unknown error'}`;
  const data = err?.response?.data;
  const body = data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data);
  return new EclipseLoginError(
    context.getNode(),
    message,
    status ? String(status) : null,
    body ? `Eclipse response: ${body.slice(0, 1000)}` : undefined,
  );
}

// n8n's "options" fields show a UI warning when an expression resolves to a
// value that doesn't exactly match one of the declared options (case included),
// even though execution isn't actually blocked by it. Since Eclipse's status
// values are case-sensitive, this normalizes case-insensitive matches (e.g.
// "shipwhencomplete" from an upstream CRM field) to the exact casing the API
// expects, so expression-driven input works without the caller needing to
// match the enum's casing exactly.
export function normalizeEnumValue(value: string, validValues: Array<{ value: string }>): string {
  const match = validValues.find((v) => v.value.toLowerCase() === value.toLowerCase());
  return match ? match.value : value;
}

// `string`-typed parameters can still resolve to a number at runtime (e.g. an
// expression pulling an ID field from upstream JSON), and calling `.trim()`
// directly on that throws "value.trim is not a function". Coerce to string
// first so both plain numbers and strings are accepted.
export function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim();
}

// `json`-typed parameters are stored as a raw JSON string when set manually,
// but when set via an expression that resolves to an array/object, n8n
// passes that value through as-is (not re-stringified) — calling JSON.parse
// on it would throw. Accept either shape.
export function parseJsonParameter<T>(value: unknown): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return value as T;
  const trimmed = value.trim();
  return trimmed ? (JSON.parse(trimmed) as T) : undefined;
}

// Several fields (e.g. entity/contact IDs, ship-to lists, types) accept a
// comma-separated list in the UI instead of n8n's fixedCollection UI, since
// a plain string is faster to fill in and works better with expressions.
export function parseCommaSeparatedList(value: string): string[] {
  return toTrimmedString(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
