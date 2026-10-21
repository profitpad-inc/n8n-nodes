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
 * Performs a single Microsoft Graph request, transparently retrying on 429
 * (falls back to a fixed 5s delay — Graph's `Retry-After` header isn't
 * visible here, see below) and letting a 401 fall through as a thrown error.
 * `body` is only relevant for write methods (POST/PATCH/...) — Graph actions
 * like `sendMail` return `202 Accepted` with no response body at all, which
 * is normalized to `{}` rather than returned as-is.
 *
 * Deliberately does **not** pass `ignoreHttpStatusErrors: true`: this credential's
 * access token is `expirable`, and n8n only calls its `preAuthentication()` again
 * to refresh an expired token when `httpRequestWithAuthentication` itself sees the
 * request throw on a 401 (see `MicrosoftOutlookApi.credentials.ts` /
 * `preAuthentication`). Suppressing that throw to read the status code directly
 * silently disabled the automatic refresh-and-retry — the access token would only
 * ever get renewed by re-saving the credential by hand. The trade-off is that a
 * 429's `Retry-After` header is no longer reachable here (`NodeApiError` doesn't
 * preserve response headers), so the fixed fallback delay is now the only delay.
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
		try {
			const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'microsoftOutlookApi', {
				method,
				url,
				qs,
				...(body !== undefined ? { body } : {}),
				json: true,
			})) as IDataObject | undefined;

			return response && typeof response === 'object' ? response : {};
		} catch (error) {
			if (error instanceof NodeApiError && error.httpCode === '429') {
				await delay(DEFAULT_RETRY_AFTER_SECONDS * 1000);
				continue;
			}

			// `error` here is already a `NodeApiError` thrown by `httpRequestWithAuthentication`
			// (or, for the final 429 case below, one we built ourselves); `NodeApiError`'s
			// constructor returns an existing `NodeApiError` unchanged (its
			// `errorResponse instanceof NodeApiError` short-circuit), so this satisfies the
			// no-bare-rethrow lint rule as a no-op rather than double-wrapping.
			throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
		}
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
