import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

/** Graph paginates up to this many total records as a runaway-loop safety valve. */
const MAX_TOTAL_RESULTS = 50_000;
/** Fixed delay between paginated page fetches. */
const PAGE_DELAY_MS = 100;
/** Give up after this many consecutive 429 responses for a single request. */
const MAX_RATE_LIMIT_RETRIES = 5;
const DEFAULT_RETRY_AFTER_SECONDS = 5;

export const MAILBOX_FOLDER_PATHS: Record<string, string> = {
	inbox: 'inbox',
	sent: 'sentitems',
	junk: 'junkemail',
	drafts: 'drafts',
	archived: 'archive',
	deleted: 'deleteditems',
};

async function delay(ms: number): Promise<void> {
	// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
	await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a single Microsoft Graph request, transparently retrying on 429 by
 * honouring the `Retry-After` header (falls back to 5s when it's missing).
 * `body` is only relevant for write methods (POST/PATCH/...) — Graph actions
 * like `sendMail` return `202 Accepted` with no response body at all, which
 * is normalized to `{}` rather than returned as-is.
 */
export async function microsoftGraphApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	url: string,
	qs: IDataObject = {},
	itemIndex = 0,
	body?: IDataObject,
): Promise<IDataObject> {
	for (let attempt = 0; attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
		const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'microsoftOutlookApi', {
			method,
			url,
			qs,
			...(body !== undefined ? { body } : {}),
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		})) as { statusCode: number; headers: IDataObject; body: IDataObject };

		if (response.statusCode >= 200 && response.statusCode < 300) {
			return response.body && typeof response.body === 'object' ? response.body : {};
		}

		if (response.statusCode === 429) {
			const retryAfterHeader = response.headers['retry-after'] as string | undefined;
			const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
			await delay((Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : DEFAULT_RETRY_AFTER_SECONDS) * 1000);
			continue;
		}

		throw new NodeApiError(this.getNode(), response.body as JsonObject, {
			itemIndex,
			httpCode: String(response.statusCode),
		});
	}

	throw new NodeApiError(
		this.getNode(),
		{ message: 'Microsoft Graph kept responding 429 (rate limited); gave up retrying' } as JsonObject,
		{ itemIndex },
	);
}

export interface PaginationOptions {
	returnAll: boolean;
	returnAllMode: 'allInOne' | 'eachPage' | 'eachResult';
	maxResults: number;
}

/**
 * Runs a Graph collection GET (messages, attachments, ...), following
 * `@odata.nextLink` when `returnAll` is set. Always waits `PAGE_DELAY_MS`
 * between page fetches.
 */
export async function paginatedGraphRequest(
	this: IExecuteFunctions,
	url: string,
	qs: IDataObject,
	options: PaginationOptions,
	itemIndex: number,
): Promise<IDataObject[]> {
	if (!options.returnAll) {
		const body = await microsoftGraphApiRequest.call(this, 'GET', url, qs, itemIndex);
		return [body];
	}

	const pages: IDataObject[] = [];
	let totalResults = 0;
	let nextUrl: string | undefined = url;
	let nextQs: IDataObject | undefined = qs;

	while (nextUrl) {
		const body = await microsoftGraphApiRequest.call(this, 'GET', nextUrl, nextQs, itemIndex);
		pages.push(body);
		totalResults += ((body.value as IDataObject[]) ?? []).length;

		const nextLink = body['@odata.nextLink'] as string | undefined;
		const hitMaxResults = options.maxResults > 0 && totalResults >= options.maxResults;
		const hitSafetyCap = totalResults >= MAX_TOTAL_RESULTS;

		if (!nextLink || hitMaxResults || hitSafetyCap) {
			break;
		}

		// @odata.nextLink already carries every query parameter that was sent.
		nextUrl = nextLink;
		nextQs = undefined;
		await delay(PAGE_DELAY_MS);
	}

	return pages;
}

/**
 * Fetches every page of a Graph collection (no user-facing limit — attachment
 * lists are small in practice) and flattens their `value` arrays into one.
 */
export async function fetchAllGraphResults(
	this: IExecuteFunctions,
	url: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const pages = await paginatedGraphRequest.call(
		this,
		url,
		{},
		{ returnAll: true, returnAllMode: 'allInOne', maxResults: 0 },
		itemIndex,
	);
	return pages.flatMap((page) => (page.value as IDataObject[]) ?? []);
}
