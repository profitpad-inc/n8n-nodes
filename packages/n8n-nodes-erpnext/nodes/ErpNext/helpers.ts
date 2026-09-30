import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodePropertyOptions,
	IPollFunctions,
	NodeOperationError,
} from 'n8n-workflow';

export const CREDENTIAL_NAME = 'erpNextTokenApi';

type ErpNextContext = IExecuteFunctions | IPollFunctions | ILoadOptionsFunctions;

// ── Retry ────────────────────────────────────────────────────────────────────
// Every ERPNext call in this package goes through erpNextRequest, which retries
// responses that mean "not processed, try again": 429 (rate limit) and the
// gateway errors a Frappe site behind nginx returns while gunicorn restarts
// (502/503/504). Any other error, and a retryable one still failing after the
// last attempt, is re-thrown unchanged so callers' 404 checks and Continue On
// Fail keep working.
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 20000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

interface HttpErrorShape {
	httpCode?: string | number | null;
	status?: number;
	statusCode?: number;
	description?: string | null;
	response?: { status?: number; data?: unknown };
	cause?: HttpErrorShape;
}

/** Reads the HTTP status from a NodeApiError, its `cause`, or a raw axios error. */
export function getErrorStatus(error: HttpErrorShape | undefined): number | undefined {
	if (!error) return undefined;
	const candidates = [
		error.httpCode,
		error.response?.status,
		error.statusCode,
		error.status,
		error.cause?.response?.status,
		error.cause?.statusCode,
		error.cause?.status,
	];
	for (const candidate of candidates) {
		const status = Number(candidate);
		if (candidate !== undefined && candidate !== null && Number.isFinite(status)) return status;
	}
	return undefined;
}

function retryDelayMs(attempt: number): number {
	const backoff = BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
	return Math.min(backoff, MAX_DELAY_MS);
}

export async function getBaseUrl(this: ErpNextContext): Promise<string> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	return String(credentials.baseUrl ?? '')
		.trim()
		.replace(/\/+$/, '');
}

/**
 * Drop-in replacement for
 * `this.helpers.httpRequestWithAuthentication.call(this, 'erpNextTokenApi', options)`
 * that retries 429/502/503/504 with exponential backoff (1s, 2s, 4s, 8s plus
 * up to 250ms jitter, each wait capped at MAX_DELAY_MS).
 */
export async function erpNextRequest(
	this: ErpNextContext,
	options: IHttpRequestOptions,
): Promise<IDataObject> {
	for (let attempt = 0; ; attempt++) {
		try {
			return (await this.helpers.httpRequestWithAuthentication.call(
				this,
				CREDENTIAL_NAME,
				options,
			)) as IDataObject;
		} catch (error) {
			const status = getErrorStatus(error as HttpErrorShape);
			if (attempt >= MAX_RETRIES || status === undefined || !RETRYABLE_STATUSES.has(status)) {
				// Re-thrown as-is on purpose: callers check the status for 404s and
				// wrap it themselves, so this wrapper must not change its shape.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				throw error;
			}
			// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
			await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
		}
	}
}

/** Builds and sends one request against the site in the credential. */
export async function erpNextApi(
	this: ErpNextContext,
	method: IHttpRequestMethods,
	path: string,
	params: { qs?: IDataObject; body?: IDataObject } = {},
): Promise<IDataObject> {
	const baseUrl = await getBaseUrl.call(this);
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
		headers: { accept: 'application/json' },
	};
	if (params.qs && Object.keys(params.qs).length > 0) options.qs = params.qs;
	if (params.body !== undefined) options.body = params.body;
	return await erpNextRequest.call(this, options);
}

export function resourcePath(docType: string, name?: string): string {
	const base = `/api/resource/${encodeURIComponent(docType)}`;
	return name === undefined ? base : `${base}/${encodeURIComponent(name)}`;
}

// ── Error messages ───────────────────────────────────────────────────────────
// Frappe puts the human-readable reason in `_server_messages` (a JSON string of
// JSON strings, each with a `message`), or in `exception`
// ("frappe.exceptions.ValidationError: <message>"). This digs it out so the
// n8n error says what ERPNext actually complained about.

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function stripHtml(text: string): string {
	return text
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function describeErpNextError(error: HttpErrorShape | undefined): string | undefined {
	if (!error) return undefined;
	const bodies = [
		error.response?.data,
		error.cause?.response?.data,
		parseMaybeJson(error.description),
	];
	for (const raw of bodies) {
		const body = parseMaybeJson(raw);
		if (!body || typeof body !== 'object') continue;
		const data = body as IDataObject;
		const serverMessages = parseMaybeJson(data._server_messages);
		if (Array.isArray(serverMessages)) {
			const messages = serverMessages
				.map((entry) => parseMaybeJson(entry))
				.map((entry) =>
					entry && typeof entry === 'object' ? (entry as IDataObject).message : entry,
				)
				.filter((message): message is string => typeof message === 'string' && message !== '')
				.map(stripHtml);
			if (messages.length > 0) return messages.join(' | ');
		}
		if (typeof data.exception === 'string' && data.exception !== '') {
			return stripHtml(data.exception.replace(/^[\w.]+Error:\s*/, ''));
		}
		if (typeof data.message === 'string' && data.message !== '') return stripHtml(data.message);
	}
	return undefined;
}

// ── Change detection ─────────────────────────────────────────────────────────
// Used by Update/Upsert "Skip If Unchanged": compare only the fields being
// sent with what ERPNext already stores, after normalizing both, so a sync that
// echoes a value back writes nothing (and so triggers nothing).

/** Bookkeeping keys on child-table rows that a caller never means to compare. */
const CHILD_ROW_META_KEYS = new Set([
	'name',
	'owner',
	'creation',
	'modified',
	'modified_by',
	'docstatus',
	'idx',
	'parent',
	'parentfield',
	'parenttype',
	'doctype',
]);

type Scalar = string | number;

/** Empty means empty: null, undefined and '' are the same; booleans become Check 0/1. */
export function normalizeScalar(value: unknown): Scalar {
	if (value === undefined || value === null) return '';
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (typeof value === 'number') return Number.isFinite(value) ? value : '';
	if (typeof value === 'string') return value.trim();
	return JSON.stringify(value);
}

function scalarsEqual(a: unknown, b: unknown): boolean {
	const left = normalizeScalar(a);
	const right = normalizeScalar(b);
	if (left === right) return true;
	// A number on one side and its numeric string on the other ("5" vs 5) is
	// the same value. Only coerced when one side really is a number, so IDs
	// with leading zeros ("007") are never turned into 7.
	if (typeof left === 'number' && typeof right === 'string' && right !== '') {
		return Number(right) === left;
	}
	if (typeof right === 'number' && typeof left === 'string' && left !== '') {
		return Number(left) === right;
	}
	return false;
}

function isPlainObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalRow(row: IDataObject, keys: string[]): string {
	return JSON.stringify(keys.map((key) => [key, normalizeScalar(row[key])]));
}

/**
 * Child tables compare as unordered sets of rows, looking only at the columns
 * the desired rows actually set (ERPNext adds name/idx/parent and defaults).
 */
function childRowsEqual(desired: unknown[], current: unknown): boolean {
	const currentRows = Array.isArray(current) ? current : [];
	if (desired.length !== currentRows.length) return false;
	const keys = Array.from(
		new Set(
			desired.flatMap((row) =>
				isPlainObject(row) ? Object.keys(row).filter((key) => !CHILD_ROW_META_KEYS.has(key)) : [],
			),
		),
	).sort();
	const toKeys = (rows: unknown[]) =>
		rows.map((row) => canonicalRow(isPlainObject(row) ? row : {}, keys)).sort();
	const left = toKeys(desired);
	const right = toKeys(currentRows);
	return left.every((value, index) => value === right[index]);
}

export function valuesEqual(desired: unknown, current: unknown): boolean {
	if (Array.isArray(desired)) return childRowsEqual(desired, current);
	if (isPlainObject(desired)) {
		const currentObject = isPlainObject(current) ? current : {};
		return Object.keys(desired).every((key) => valuesEqual(desired[key], currentObject[key]));
	}
	return scalarsEqual(desired, current);
}

export interface FieldChange {
	field: string;
	from: unknown;
	to: unknown;
}

/** The fields in `desired` whose value differs from `current`. */
export function diffFields(desired: IDataObject, current: IDataObject): FieldChange[] {
	const changes: FieldChange[] = [];
	for (const field of Object.keys(desired)) {
		if (field === 'doctype') continue;
		if (!valuesEqual(desired[field], current[field])) {
			changes.push({ field, from: current[field] ?? null, to: desired[field] });
		}
	}
	return changes;
}

// ── Frappe datetimes ─────────────────────────────────────────────────────────
// ERPNext returns naive local datetimes ("2026-09-30 16:50:18.861987", and no
// fraction at all when the microseconds are 0). The trigger never converts time
// zones: it only compares and subtracts, so the values are treated as plain
// numbers of microseconds on a UTC-shaped scale.

const FRAPPE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?/;

export function parseFrappeDatetime(value: unknown): number | undefined {
	if (typeof value !== 'string') return undefined;
	const match = FRAPPE_DATETIME.exec(value.trim());
	if (!match) return undefined;
	const [, year, month, day, hour, minute, second, fraction = ''] = match;
	const ms = Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second),
	);
	return ms * 1000 + Number(fraction.padEnd(6, '0'));
}

export function formatFrappeDatetime(micros: number): string {
	const ms = Math.floor(micros / 1000);
	const fraction = String(Math.round(micros - ms * 1000)).padStart(3, '0');
	const date = new Date(ms);
	const pad = (n: number, width = 2) => String(n).padStart(width, '0');
	return (
		`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
		`${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
		`${pad(date.getUTCMilliseconds(), 3)}${fraction}`
	);
}

/** `watermark` minus `seconds`, in ERPNext's own datetime format. */
export function windowStartFrom(watermark: string, seconds: number): string {
	const micros = parseFrappeDatetime(watermark);
	if (micros === undefined) return watermark;
	return formatFrappeDatetime(micros - Math.max(0, seconds) * 1_000_000);
}

/** The latest `field` value among `docs`, or `current` if none is later. */
export function latestDatetime(
	docs: IDataObject[],
	field: string,
	current?: string,
): string | undefined {
	let best = current;
	let bestMicros = parseFrappeDatetime(current) ?? -Infinity;
	for (const doc of docs) {
		const micros = parseFrappeDatetime(doc[field]);
		if (micros !== undefined && micros > bestMicros) {
			bestMicros = micros;
			best = String(doc[field]);
		}
	}
	return best;
}

/**
 * Drops docs already emitted by an earlier poll whose window overlapped this
 * one (same name and same `field` value), records the rest, and prunes entries
 * older than the window so the store stays small. Mutates `emitted`.
 */
export function selectUnseen(
	docs: IDataObject[],
	emitted: Record<string, number>,
	windowStart: string,
	field = 'modified',
): IDataObject[] {
	const windowStartMicros = parseFrappeDatetime(windowStart) ?? -Infinity;
	for (const key of Object.keys(emitted)) {
		if (emitted[key] < windowStartMicros) delete emitted[key];
	}
	const unseen: IDataObject[] = [];
	for (const doc of docs) {
		const key = `${String(doc.name)}|${String(doc[field])}`;
		if (emitted[key] !== undefined) continue;
		emitted[key] = parseFrappeDatetime(doc[field]) ?? windowStartMicros;
		unseen.push(doc);
	}
	return unseen;
}

// ── Parameters ───────────────────────────────────────────────────────────────

export function parseJsonParameter<T>(
	node: INode,
	value: unknown,
	label: string,
	fallback: T,
	itemIndex?: number,
): T {
	if (value === undefined || value === null || value === '') return fallback;
	if (typeof value !== 'string') return value as T;
	try {
		return JSON.parse(value) as T;
	} catch {
		throw new NodeOperationError(node, `${label} is not valid JSON`, { itemIndex });
	}
}

export function fieldValuesToObject(fieldValues: Array<{ name?: string; value?: unknown }>) {
	const result: IDataObject = {};
	for (const entry of fieldValues) {
		const name = String(entry.name ?? '').trim();
		if (name) result[name] = entry.value as IDataObject[keyof IDataObject];
	}
	return result;
}

// ── Load options ─────────────────────────────────────────────────────────────
// DocType and field lists change rarely; cache them per site for two minutes so
// opening a node doesn't re-download the DocType list on every dropdown.
const LOAD_OPTIONS_TTL_MS = 2 * 60 * 1000;
const loadOptionsCache = new Map<string, { expires: number; options: INodePropertyOptions[] }>();

async function cached(
	this: ILoadOptionsFunctions,
	key: string,
	load: () => Promise<INodePropertyOptions[]>,
): Promise<INodePropertyOptions[]> {
	const cacheKey = `${await getBaseUrl.call(this)}|${key}`;
	const hit = loadOptionsCache.get(cacheKey);
	if (hit && hit.expires > Date.now()) return hit.options;
	const options = await load();
	loadOptionsCache.set(cacheKey, { expires: Date.now() + LOAD_OPTIONS_TTL_MS, options });
	return options;
}

export async function getDocTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return await cached.call(this, 'doctypes', async () => {
		const response = await erpNextApi.call(this, 'GET', resourcePath('DocType'), {
			qs: {
				fields: JSON.stringify(['name', 'module']),
				filters: JSON.stringify([['istable', '=', 0]]),
				order_by: 'name asc',
				limit_page_length: 0,
			},
		});
		const rows = (response.data as IDataObject[] | undefined) ?? [];
		return rows.map((row) => ({
			name: String(row.name),
			value: String(row.name),
			description: row.module ? `Module: ${String(row.module)}` : undefined,
		}));
	});
}

const LAYOUT_FIELD_TYPES = new Set([
	'Section Break',
	'Column Break',
	'Tab Break',
	'HTML',
	'Button',
	'Fold',
	'Heading',
	'Image',
]);

const STANDARD_FIELDS: INodePropertyOptions[] = [
	{ name: 'Name (ID)', value: 'name', description: 'Fieldname: name' },
	{ name: 'Created On', value: 'creation', description: 'Fieldname: creation' },
	{ name: 'Last Modified', value: 'modified', description: 'Fieldname: modified' },
	{ name: 'Modified By', value: 'modified_by', description: 'Fieldname: modified_by' },
	{ name: 'Owner', value: 'owner', description: 'Fieldname: owner' },
];

export async function getDocTypeFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const docType = String(this.getCurrentNodeParameter('docType') ?? '').trim();
	if (!docType) return STANDARD_FIELDS;
	return await cached.call(this, `fields:${docType}`, async () => {
		try {
			const response = await erpNextApi.call(
				this,
				'GET',
				'/api/method/frappe.desk.form.load.getdoctype',
				{ qs: { doctype: docType } },
			);
			const docs = (response.docs as IDataObject[] | undefined) ?? [];
			const meta = docs.find((doc) => doc.name === docType) ?? docs[0];
			const fields = ((meta?.fields as IDataObject[] | undefined) ?? [])
				.filter((field) => field.fieldname && !LAYOUT_FIELD_TYPES.has(String(field.fieldtype)))
				.map((field) => ({
					name: `${String(field.label || field.fieldname)} (${String(field.fieldname)})`,
					value: String(field.fieldname),
					description: String(field.fieldtype),
				}));
			return [...STANDARD_FIELDS, ...fields];
		} catch {
			return STANDARD_FIELDS;
		}
	});
}
