import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

export const NINETY_BASE = 'https://api.public.ninety.io';
export const API_BASE_PATH = '/v1';
export const BASE_HEADERS = {
	'content-type': 'application/json',
	accept: 'application/json',
};

// ── Rate-limit retry ─────────────────────────────────────────────────────────
// Every Ninety call in this package goes through ninetyRequest, which retries
// a request rejected with 429 Too Many Requests. A 429 means the request was
// not processed, so retrying is safe for POST/DELETE too. Any other error, and
// a 429 that is still failing after the last retry, is re-thrown unchanged.
// Ninety's swagger does not document a rate limit, so the backoff mirrors the
// HubSpot package (2s, 4s, 8s, 16s).
const RATE_LIMIT_MAX_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 30000;

type NinetyRequestContext = IExecuteFunctions | ILoadOptionsFunctions;

interface HttpErrorShape {
	httpCode?: string | number | null;
	status?: number;
	statusCode?: number;
	response?: { status?: number; headers?: Record<string, unknown> };
	headers?: Record<string, unknown>;
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

/** Retry-After in ms (seconds or an HTTP date), when it can be found. */
function getRetryAfterMs(error: HttpErrorShape): number | undefined {
	const headers = error.response?.headers ?? error.cause?.response?.headers ?? error.headers;
	if (!headers) return undefined;
	const raw = headers['retry-after'] ?? headers['Retry-After'];
	if (raw === undefined || raw === null || raw === '') return undefined;
	const seconds = Number(raw);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(String(raw));
	return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function rateLimitDelayMs(error: HttpErrorShape, attempt: number): number {
	const retryAfter = getRetryAfterMs(error);
	const backoff = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
	return Math.min(retryAfter ?? backoff, RATE_LIMIT_MAX_DELAY_MS);
}

/**
 * Drop-in replacement for
 * `this.helpers.httpRequestWithAuthentication.call(this, 'ninetyApi', options)`
 * that retries 429 responses up to RATE_LIMIT_MAX_RETRIES times.
 */
export async function ninetyRequest(
	this: NinetyRequestContext,
	options: IHttpRequestOptions,
): ReturnType<IExecuteFunctions['helpers']['httpRequestWithAuthentication']> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, 'ninetyApi', options);
		} catch (error) {
			if (attempt >= RATE_LIMIT_MAX_RETRIES || getErrorStatus(error as HttpErrorShape) !== 429) {
				// Re-thrown as-is on purpose: execute() wraps it in NodeApiError.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				throw error;
			}
			const delayMs = rateLimitDelayMs(error as HttpErrorShape, attempt);
			// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
			await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

/** Builds `https://api.public.ninety.io/v1<path>`. */
export function ninetyUrl(path: string): string {
	return `${NINETY_BASE}${API_BASE_PATH}${path}`;
}

/**
 * Normalizes a period start date for the score endpoints into the
 * `YYYY-MM-DDT00:00:00.000Z` form the swagger examples use for both the POST
 * body and the DELETE path.
 *
 * - A date with no timezone (`YYYY-MM-DD`, or the `YYYY-MM-DDTHH:mm:ss` the
 *   n8n date picker produces) is a calendar date: its date part is sent as
 *   midnight UTC and any time of day is dropped.
 * - A datetime with `Z` or an offset (an exact instant from an expression, or
 *   a luxon DateTime) is converted to UTC ISO format.
 * - Anything unparseable is passed through for Ninety to reject.
 */
export function normalizePeriodStartDate(raw: unknown): string {
	const value =
		raw !== null && typeof raw === 'object' && 'toISO' in raw
			? String((raw as { toISO: () => string }).toISO())
			: String(raw ?? '').trim();
	const calendarDate = /^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.exec(value);
	if (calendarDate) return `${calendarDate[1]}T00:00:00.000Z`;
	const instant = new Date(value);
	return value && !Number.isNaN(instant.getTime()) ? instant.toISOString() : value;
}

// ── Response shapes (only the fields this node reads) ────────────────────────

/** Any JSON value Ninety may return for a loosely typed field (goal, note, value...). */
type JsonValue = IDataObject[string];

export interface ScorecardScore extends IDataObject {
	label: string;
	periodStartDate: string;
	isFuture: boolean;
	partialInterval?: boolean;
	value?: JsonValue;
	goal?: JsonValue;
	note?: JsonValue;
}

export interface ScorecardKpi extends IDataObject {
	id: string;
	title: string;
	unit: string;
	currency?: string;
	ownerName?: string;
	defaultGoal?: JsonValue;
	average?: JsonValue;
	total?: JsonValue;
	scores: ScorecardScore[];
}

export interface ScorecardGroup extends IDataObject {
	id: string;
	name: string;
	kpis: ScorecardKpi[];
}

export interface TeamScorecardResponse extends IDataObject {
	id: string;
	name: string;
	periodInterval: string;
	teamId: string;
	periods: IDataObject[];
	groups: ScorecardGroup[];
}

interface AvailableTeam {
	_id: string;
	name: string;
	isMember?: boolean;
}

interface KpiQueryItem {
	_id: string;
	title: string;
	periodInterval?: string;
	userFullName?: string;
	type?: string;
	teams?: Array<{ id: string; name: string }>;
}

interface PaginatedKpiResponse {
	items?: KpiQueryItem[];
	itemsCount?: number;
	totalCount?: number;
	totalPages?: number;
}

// ── Load options ─────────────────────────────────────────────────────────────

/**
 * Teams for the Team dropdown, from `GET /v1/teams/available`. That endpoint
 * includes every Team the user can work on (all non-private Teams for an
 * Owner, Admin or Implementer), unlike `GET /v1/teams`, which only returns the
 * caller's own Teams. Names are shown without any "(not a member)" suffix.
 */
export async function getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const teams = (await ninetyRequest.call(this, {
		method: 'GET',
		url: ninetyUrl('/teams/available'),
		headers: BASE_HEADERS,
	})) as AvailableTeam[];

	return (teams ?? [])
		.map((team) => ({
			name: team.name.replace(/\s*\(not a member\)\s*$/i, '').trim(),
			value: team._id,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

const KPI_QUERY_PAGE_SIZE = 100;
const KPI_QUERY_MAX_PAGES = 50;

/**
 * Measurables for the Measurable dropdown, from `POST /v1/scorecard/kpis/query`,
 * filtered by the node's Team and Period Interval, paged until every item is
 * read. The swagger's `pageIndex` example is 0 while
 * the response's `currentPage` is documented as 1-based, so paging starts at 0
 * and dedupes by Id; it stops on an empty page, once `totalCount` is reached,
 * or at KPI_QUERY_MAX_PAGES.
 */
export async function getKpis(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const byId = new Map<string, KpiQueryItem>();

	// The Team and Period Interval fields above the Measurable dropdown narrow
	// the query; an empty Team lists Measurables from every Team.
	const filters: IDataObject = {};
	const teamId = String(this.getCurrentNodeParameter('teamId') ?? '').trim();
	const periodInterval = String(this.getCurrentNodeParameter('periodInterval') ?? '').trim();
	if (teamId) filters.teamId = teamId;
	if (periodInterval) filters.periodInterval = periodInterval;

	for (let pageIndex = 0; pageIndex < KPI_QUERY_MAX_PAGES; pageIndex++) {
		const page = (await ninetyRequest.call(this, {
			method: 'POST',
			url: ninetyUrl('/scorecard/kpis/query'),
			headers: BASE_HEADERS,
			body: JSON.stringify({
				...filters,
				pageIndex,
				pageSize: KPI_QUERY_PAGE_SIZE,
				sortField: 'title',
				sortDirection: 'ASC',
			}),
		})) as PaginatedKpiResponse;

		const items = page.items ?? [];
		const sizeBefore = byId.size;
		for (const item of items) byId.set(item._id, item);

		if (items.length === 0 || byId.size === sizeBefore) break;
		if (page.totalCount !== undefined && byId.size >= page.totalCount) break;
	}

	return [...byId.values()]
		.map((kpi) => {
			const teamNames = (kpi.teams ?? []).map((team) => team.name).join(', ');
			const details = [teamNames, kpi.periodInterval, kpi.type === 'archived' ? 'archived' : '']
				.filter(Boolean)
				.join(', ');
			return {
				name: details ? `${kpi.title} (${details})` : kpi.title,
				value: kpi._id,
				description: kpi.userFullName ? `Owner: ${kpi.userFullName}` : undefined,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}
