import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeOperationError,
} from 'n8n-workflow';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const PROPERTIES_BASE_PATH = '/crm/properties/2026-03';
export const OWNERS_BASE_PATH = '/crm/v3/owners';

export const OBJECT_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Calls (0-48)', value: '0-48' },
	{ name: 'Carts (0-142)', value: '0-142' },
	{ name: 'Communications (0-18)', value: '0-18' },
	{ name: 'Companies (0-2)', value: '0-2' },
	{ name: 'Contacts (0-1)', value: '0-1' },
	{ name: 'Contracts (0-721)', value: '0-721' },
	{ name: 'Deals (0-3)', value: '0-3' },
	{ name: 'Emails (0-49)', value: '0-49' },
	{ name: 'Invoices (0-53)', value: '0-53' },
	{ name: 'Leads (0-136)', value: '0-136' },
	{ name: 'Line Items (0-8)', value: '0-8' },
	{ name: 'Meetings (0-47)', value: '0-47' },
	{ name: 'Notes (0-46)', value: '0-46' },
	{ name: 'Orders (0-123)', value: '0-123' },
	{ name: 'Payments (0-101)', value: '0-101' },
	{ name: 'Products (0-7)', value: '0-7' },
	{ name: 'Projects (0-970)', value: '0-970' },
	{ name: 'Quotes (0-14)', value: '0-14' },
	{ name: 'Services (0-162)', value: '0-162' },
	{ name: 'Subscriptions (0-69)', value: '0-69' },
	{ name: 'Tasks (0-27)', value: '0-27' },
	{ name: 'Tickets (0-5)', value: '0-5' },
	{ name: 'Users (Users)', value: 'users' },
];

export function buildHubSpotUrl(
	base: string,
	path: string,
	params: Record<string, string | string[] | number | boolean | undefined>,
): string {
	const url = new URL(base + path);
	for (const [key, val] of Object.entries(params)) {
		if (val === undefined || val === '' || val === false) continue;
		if (Array.isArray(val)) {
			for (const v of val) url.searchParams.append(key, v);
		} else {
			url.searchParams.set(key, String(val));
		}
	}
	return url.toString();
}

interface HubSpotPropertySummary {
	name: string;
	label: string;
	type: string;
	modificationMetadata?: {
		readOnlyDefinition?: boolean;
		readOnlyValue?: boolean;
	};
}

async function fetchProperties(this: ILoadOptionsFunctions): Promise<HubSpotPropertySummary[]> {
	const objectType = this.getCurrentNodeParameter('objectType') as string;
	if (!objectType) return [];

	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
		method: 'GET',
		url: `${HUBSPOT_BASE}${PROPERTIES_BASE_PATH}/${objectType}`,
		headers: { accept: 'application/json' },
	})) as { results?: HubSpotPropertySummary[] };

	return response.results ?? [];
}

export async function getProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const properties = await fetchProperties.call(this);
	return properties
		.filter((property) => !property.modificationMetadata?.readOnlyDefinition)
		.map((property) => ({ name: `${property.label} (${property.name})`, value: property.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEnumerationProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const properties = await fetchProperties.call(this);
	return properties
		.filter(
			(property) => property.type === 'enumeration' && !property.modificationMetadata?.readOnlyValue,
		)
		.map((property) => ({ name: `${property.label} (${property.name})`, value: property.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const properties = await fetchProperties.call(this);
	return properties
		.map((property) => ({ name: `${property.label} (${property.name})`, value: property.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

interface HubSpotOwner {
	id: string;
	email?: string;
	userId?: number | string | null;
	userIdIncludingInactive?: number | string | null;
	[key: string]: unknown;
}

/**
 * The Owners API only exposes a user's ID via the linked owner record, so
 * resolving "user details from an owner ID" requires first reading the
 * owner to discover its `userId`.
 */
export async function resolveUserIdFromOwnerId(
	this: IExecuteFunctions,
	ownerId: string,
	itemIndex: number,
): Promise<string> {
	const owner = (await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
		method: 'GET',
		url: `${HUBSPOT_BASE}${OWNERS_BASE_PATH}/${ownerId}`,
		headers: { accept: 'application/json' },
	})) as HubSpotOwner;

	if (owner.userId === undefined || owner.userId === null) {
		throw new NodeOperationError(
			this.getNode(),
			`Owner ${ownerId} has no linked active user (userId is null)`,
			{ itemIndex },
		);
	}

	return String(owner.userId);
}

/**
 * The single-owner GET endpoint only supports lookup by owner ID, so
 * finding an owner by any other field (user ID, email, ...) requires
 * paging through the list endpoint and matching client-side.
 */
export async function findOwnerByField(
	this: IExecuteFunctions,
	field: string,
	value: string,
	archived: boolean,
	maxPages = 20,
): Promise<HubSpotOwner | undefined> {
	let after: string | undefined;
	let page = 0;

	do {
		const url = buildHubSpotUrl(HUBSPOT_BASE, OWNERS_BASE_PATH, { archived, after, limit: 100 });
		const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
			method: 'GET',
			url,
			headers: { accept: 'application/json' },
		})) as { results?: HubSpotOwner[]; paging?: { next?: { after?: string } } };

		const match = (response.results ?? []).find((owner) => String(owner[field]) === value);
		if (match) return match;

		after = response.paging?.next?.after;
		page++;
	} while (after && page < maxPages);

	return undefined;
}

export interface UsersLookup {
	realId: string;
	idPropertyParam?: string;
}

/**
 * Resolves the "ID Property" dropdown value for the Users object type into
 * the actual ID and (if needed) idProperty query param to send to
 * /crm/v3/objects/users. An owner's `userId` field does not match the Users
 * object's own `id` — it matches the `hs_internal_user_id` property instead,
 * so both the User ID and Owner ID options go through that property rather
 * than a native path lookup. Looking a user up by email has to go through
 * the Owners API first, since the Users object has no email property.
 */
export async function resolveUsersLookup(
	this: IExecuteFunctions,
	idProperty: string,
	objectId: string,
	itemIndex: number,
): Promise<UsersLookup> {
	if (idProperty === 'ownerId') {
		const userId = await resolveUserIdFromOwnerId.call(this, objectId, itemIndex);
		return { realId: userId, idPropertyParam: 'hs_internal_user_id' };
	}

	if (idProperty === 'userId') {
		return { realId: objectId, idPropertyParam: 'hs_internal_user_id' };
	}

	if (idProperty === 'email') {
		// Archived owners always have a null userId, so only active owners are searched.
		const owner = await findOwnerByField.call(this, 'email', objectId, false);
		if (!owner || owner.userId === undefined || owner.userId === null) {
			throw new NodeOperationError(
				this.getNode(),
				`No active owner found with email "${objectId}"`,
				{ itemIndex },
			);
		}
		return { realId: String(owner.userId), idPropertyParam: 'hs_internal_user_id' };
	}

	if (idProperty === 'id' || idProperty === 'hs_object_id') {
		return { realId: objectId };
	}

	return { realId: objectId, idPropertyParam: idProperty };
}
