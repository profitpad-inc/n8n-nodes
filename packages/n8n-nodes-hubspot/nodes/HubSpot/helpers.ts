import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeOperationError,
} from 'n8n-workflow';

import { ASSOCIATION_TYPES } from './associationTypes';

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
	{ name: 'Postal Mail (0-116)', value: '0-116' },
	{ name: 'Products (0-7)', value: '0-7' },
	{ name: 'Projects (0-970)', value: '0-970' },
	{ name: 'Quotes (0-14)', value: '0-14' },
	{ name: 'Services (0-162)', value: '0-162' },
	{ name: 'Subscriptions (0-69)', value: '0-69' },
	{ name: 'Tasks (0-27)', value: '0-27' },
	{ name: 'Tickets (0-5)', value: '0-5' },
	{ name: 'Users (0-115)', value: '0-115' },
];

// Users aren't associable CRM records, so the Associations resource's From/To
// Object Type fields exclude the Users entry that the Objects and Properties
// resources otherwise share via OBJECT_TYPE_OPTIONS.
export const ASSOCIATION_OBJECT_TYPE_OPTIONS: INodePropertyOptions[] = OBJECT_TYPE_OPTIONS.filter(
	(option) => option.value !== '0-115',
);

// Maps the singular object name used in ASSOCIATION_TYPES labels (e.g. the
// "contact" in "Note to contact") to its object type ID, so that ID can be
// inferred from a chosen association label instead of asking for it again.
// Role-prefixed labels ("primary company", "billing contact", "upcoming line
// item") are matched on their last word(s) in getAssociationTargetObjectType,
// so only the base entity name needs an entry here.
const ASSOCIATION_TARGET_OBJECT_TYPE_BY_NAME: Record<string, string> = {
	call: '0-48',
	cart: '0-142',
	communication: '0-18',
	company: '0-2',
	contact: '0-1',
	contract: '0-721',
	deal: '0-3',
	email: '0-49',
	invoice: '0-53',
	lead: '0-136',
	'line item': '0-8',
	meeting: '0-47',
	note: '0-46',
	order: '0-123',
	payment: '0-101',
	'postal mail': '0-116',
	product: '0-7',
	project: '0-970',
	quote: '0-14',
	service: '0-162',
	subscription: '0-69',
	task: '0-27',
	ticket: '0-5',
	user: '0-115',
};

/**
 * Derives an association's target object type from its label (e.g. "Note to
 * contact" -> Contacts' 0-1) instead of requiring it as separate input — the
 * association type ID already encodes the from/to pairing. Returns '' for
 * target kinds this node doesn't otherwise expose an object type for (e.g.
 * Appointments, Feedback Submissions), which just means the ID Property
 * lookup won't be offered for that association; a raw record ID still works.
 */
export function getAssociationTargetObjectType(
	fromObjectType: string,
	associationTypeId: number | string,
): string {
	const entry = (ASSOCIATION_TYPES[fromObjectType] ?? []).find(
		([typeId]) => String(typeId) === String(associationTypeId),
	);
	if (!entry) return '';

	const target = entry[1].split(' to ').pop() ?? '';
	const words = target.trim().toLowerCase().split(/\s+/);
	const lastTwoWords = words.slice(-2).join(' ');
	if (lastTwoWords === 'line item') return ASSOCIATION_TARGET_OBJECT_TYPE_BY_NAME['line item'];

	const lastWord = words[words.length - 1] ?? '';
	return ASSOCIATION_TARGET_OBJECT_TYPE_BY_NAME[lastWord] ?? '';
}

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
	hasUniqueValue?: boolean;
	modificationMetadata?: {
		readOnlyDefinition?: boolean;
		readOnlyValue?: boolean;
	};
}

// Contacts is the one CRM object where the unified hs_createdate /
// hs_lastmodifieddate properties HubSpot exposes elsewhere are not valid
// search/sort properties (Contacts predates that naming and only accepts the
// unprefixed createdate / lastmodifieddate). Excluded at the source so every
// dropdown built from fetchProperties stays consistent.
export const CONTACTS_OBJECT_TYPE = '0-1';
const CONTACTS_INVALID_SEARCH_PROPERTIES = ['hs_createdate', 'hs_lastmodifieddate'];

// The Owners resource's "Object Type" field uses the plain strings 'users' /
// 'owners' to pick an API branch, not a HubSpot CRM type ID, so it can't be
// passed straight through to the Properties API. The Users object's actual
// type ID is 0-115.
export const USERS_OBJECT_TYPE = '0-115';

// Property definitions rarely change and every dropdown in this node
// (Properties, ID Property, Property, etc.) ultimately fetches them through
// fetchPropertiesForType, so caching here — keyed by credential + object
// type — dedupes repeated HubSpot calls across every one of those fields.
// Entries expire after PROPERTIES_CACHE_TTL_MS so a property added in HubSpot
// eventually shows up without requiring an n8n restart; a failed fetch is
// evicted immediately so a transient error doesn't stick around.
const PROPERTIES_CACHE_TTL_MS = 2 * 60 * 1000;
const propertiesCache = new Map<
	string,
	{ promise: Promise<HubSpotPropertySummary[]>; expiresAt: number }
>();

/** Fetch and filter CRM property definitions for a literal object type ID. */
async function fetchPropertiesForType(
	this: ILoadOptionsFunctions,
	objectType: string,
): Promise<HubSpotPropertySummary[]> {
	if (!objectType) return [];

	const credentialId = this.getNode().credentials?.hubspotApi?.id ?? 'unknown';
	const cacheKey = `${credentialId}:${objectType}`;

	const cached = propertiesCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.promise;

	const promise = (async () => {
		const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
			method: 'GET',
			url: `${HUBSPOT_BASE}${PROPERTIES_BASE_PATH}/${objectType}`,
			headers: { accept: 'application/json' },
		})) as { results?: HubSpotPropertySummary[] };

		// Exclude legacy properties (e.g. owneremail), which HubSpot marks with a
		// "(legacy)" suffix in the label. They should not be offered in dropdowns.
		return (response.results ?? []).filter((property) => {
			if (/\(legacy\)/i.test(property.label ?? '')) return false;
			if (
				objectType === CONTACTS_OBJECT_TYPE &&
				CONTACTS_INVALID_SEARCH_PROPERTIES.includes(property.name)
			) {
				return false;
			}
			return true;
		});
	})();

	propertiesCache.set(cacheKey, { promise, expiresAt: Date.now() + PROPERTIES_CACHE_TTL_MS });
	promise.catch(() => propertiesCache.delete(cacheKey));

	return promise;
}

/**
 * Fetch CRM property definitions for the object type named by
 * `objectTypeParam` (a plain sibling name like `objectType`/`fromObjectType`,
 * or a `&`-prefixed name to read a sibling within the same fixedCollection
 * entry, e.g. `&toObjectType`). Returns [] when that parameter can't be
 * resolved (not yet set, or not present on the current node/branch).
 */
async function fetchPropertiesForParam(
	this: ILoadOptionsFunctions,
	objectTypeParam: string,
): Promise<HubSpotPropertySummary[]> {
	let objectType = '';
	try {
		objectType = (this.getCurrentNodeParameter(objectTypeParam) as string) ?? '';
	} catch {
		objectType = '';
	}
	return fetchPropertiesForType.call(this, objectType);
}

async function fetchProperties(this: ILoadOptionsFunctions): Promise<HubSpotPropertySummary[]> {
	return fetchPropertiesForParam.call(this, 'objectType');
}

function toOption(property: HubSpotPropertySummary): INodePropertyOptions {
	return { name: `${property.label} (${property.name})`, value: property.name };
}

/**
 * Options for an "ID Property" lookup field: the record ID itself (the
 * default, represented as an empty value so it round-trips with the
 * pre-existing "blank means record ID" behaviour) plus every property marked
 * as having a unique value, which is what HubSpot allows a record to be
 * looked up by instead of its ID. HubSpot-internal `hs_`-prefixed properties
 * are excluded — they're rarely meaningful as a lookup key and just add
 * noise to the list.
 */
function toUniqueIdPropertyOptions(properties: HubSpotPropertySummary[]): INodePropertyOptions[] {
	const uniqueOptions = properties
		.filter((property) => property.hasUniqueValue && !property.name.startsWith('hs_'))
		.map(toOption)
		.sort((a, b) => a.name.localeCompare(b.name));
	return [{ name: 'Record ID', value: '' }, ...uniqueOptions];
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

/**
 * Property names already picked in other rows of a Property/Value
 * fixedCollection (Object Create's `createProperties` or Update's
 * `updateFields`), so the picker for one row can exclude what's chosen
 * elsewhere.
 */
function getSelectedPropertyNames(
	this: ILoadOptionsFunctions,
	collectionParam: string,
): string[] {
	const collection = this.getCurrentNodeParameters()?.[collectionParam] as
		| { propertyValues?: Array<{ name?: string }> }
		| undefined;
	return (collection?.propertyValues ?? [])
		.map((row) => row?.name)
		.filter((name): name is string => Boolean(name));
}

/** Properties that can be written to (used for Create/Update property pickers). */
export async function getWritableProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const properties = await fetchProperties.call(this);
	let currentValue = '';
	try {
		currentValue = (this.getCurrentNodeParameter('&name') as string) ?? '';
	} catch {
		currentValue = '';
	}
	const usedElsewhere = new Set([
		...getSelectedPropertyNames.call(this, 'createProperties'),
		...getSelectedPropertyNames.call(this, 'updateFields'),
	]);
	usedElsewhere.delete(currentValue);
	return properties
		.filter((property) => !property.modificationMetadata?.readOnlyValue)
		.filter((property) => !usedElsewhere.has(property.name))
		.map(toOption)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** All properties for the Owners resource's Users object type (0-115). */
export async function getUserProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const properties = await fetchPropertiesForType.call(this, USERS_OBJECT_TYPE);
	return properties
		.map((property) => ({ name: `${property.label} (${property.name})`, value: property.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Writable properties for the Owners resource's Users object type (0-115). */
export async function getWritableUserProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const properties = await fetchPropertiesForType.call(this, USERS_OBJECT_TYPE);
	return properties
		.filter((property) => !property.modificationMetadata?.readOnlyValue)
		.map(toOption)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** "ID Property" options for the primary `objectType` parameter. */
export async function getUniqueProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return toUniqueIdPropertyOptions(await fetchProperties.call(this));
}

/**
 * "ID Property" options for the single Upsert operation.
 *
 * Unlike the other ID Property pickers this one does not offer Record ID: an
 * upsert matches an existing record on a unique property and creates one when
 * there is no match, and a record ID that doesn't exist yet can't be created
 * against. When the object type has no unique properties at all there is
 * nothing to upsert on, so a single non-selectable entry explains the two ways
 * forward instead of showing an empty dropdown.
 */
export async function getUpsertIdProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const uniqueOptions = (await fetchProperties.call(this))
		.filter((property) => property.hasUniqueValue && !property.name.startsWith('hs_'))
		.map(toOption)
		.sort((a, b) => a.name.localeCompare(b.name));

	if (!uniqueOptions.length) {
		return [
			{
				name: 'No Unique Properties Available',
				value: '',
				description:
					'This object type has no properties with a unique value, so there is nothing to match an upsert on. Create a unique property for this object type in HubSpot, or use the Create operation instead.',
			},
		];
	}

	return uniqueOptions;
}

/** "ID Property" options scoped to the Associations resource's `fromObjectType`. */
export async function getUniquePropertiesForAssociationFrom(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return toUniqueIdPropertyOptions(await fetchPropertiesForParam.call(this, 'fromObjectType'));
}

/**
 * "ID Property" options for Object Create's association rows, scoped to the
 * object type implied by the sibling `associationTypeIds` field (e.g.
 * selecting "Note to contact" scopes this to Contacts) rather than a
 * separately-picked object type.
 */
export async function getUniquePropertiesForAssociationTo(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const objectType = (this.getCurrentNodeParameter('objectType') as string) ?? '';
	let associationTypeIds: string | string[] = [];
	try {
		associationTypeIds =
			(this.getCurrentNodeParameter('&associationTypeIds') as string | string[]) ?? [];
	} catch {
		associationTypeIds = [];
	}
	const firstTypeId = Array.isArray(associationTypeIds) ? associationTypeIds[0] : associationTypeIds;
	const toObjectType = firstTypeId
		? getAssociationTargetObjectType(objectType, firstTypeId)
		: '';
	if (!toObjectType) return [{ name: 'Record ID', value: '' }];
	return toUniqueIdPropertyOptions(await fetchPropertiesForType.call(this, toObjectType));
}

/**
 * HubSpot-defined association type ID options for associating newly created
 * records of `objectType` with other records, sourced from ASSOCIATION_TYPES.
 */
export async function getAssociationTypeIds(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const objectType = (this.getCurrentNodeParameter('objectType') as string) ?? '';
	return (ASSOCIATION_TYPES[objectType] ?? []).map(([typeId, label]) => ({
		name: `${label} (${typeId})`,
		value: String(typeId),
	}));
}

/**
 * Property options for search filters. Returns every property of the selected
 * object type plus a set of `associations.0-<associationTypeId>`
 * pseudo-properties, which HubSpot's search API uses to filter records by an
 * associated record's ID (e.g. { propertyName: 'associations.0-279',
 * operator: 'EQ', value: '123456' } finds contacts associated to company
 * 123456, since 279 is the "Contact to company" association type ID).
 */
export async function getSearchFilterProperties(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const objectType = (this.getCurrentNodeParameter('objectType') as string) ?? '';
	const properties = await fetchProperties.call(this);

	const associationOptions: INodePropertyOptions[] = (ASSOCIATION_TYPES[objectType] ?? []).map(
		([typeId, label]) => ({
			name: `${label} (associations.0-${typeId})`,
			value: `associations.0-${typeId}`,
		}),
	);

	const propertyOptions = properties
		.map((property) => ({ name: `${property.label} (${property.name})`, value: property.name }))
		.sort((a, b) => a.name.localeCompare(b.name));

	return [...associationOptions, ...propertyOptions];
}

/** All HubSpot search operators, in the order they should appear. */
export const SEARCH_OPERATORS: INodePropertyOptions[] = [
	{ name: 'Equals', value: 'EQ' },
	{ name: 'Not Equals', value: 'NEQ' },
	{ name: 'Less Than', value: 'LT' },
	{ name: 'Less Than or Equal', value: 'LTE' },
	{ name: 'Greater Than', value: 'GT' },
	{ name: 'Greater Than or Equal', value: 'GTE' },
	{ name: 'Between', value: 'BETWEEN' },
	{ name: 'In List', value: 'IN' },
	{ name: 'Not In List', value: 'NOT_IN' },
	{ name: 'Contains Token', value: 'CONTAINS_TOKEN' },
	{ name: 'Not Contains Token', value: 'NOT_CONTAINS_TOKEN' },
	{ name: 'Is Known (Has Property)', value: 'HAS_PROPERTY' },
	{ name: 'Is Unknown (Not Has Property)', value: 'NOT_HAS_PROPERTY' },
];

// Operators valid regardless of property type.
const UNIVERSAL_OPERATORS = ['EQ', 'NEQ', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY'];
const COMPARISON_OPERATORS = ['LT', 'LTE', 'GT', 'GTE', 'BETWEEN'];
const TOKEN_OPERATORS = ['CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN'];
const LIST_OPERATORS = ['IN', 'NOT_IN'];

/**
 * Which operators are valid for a given HubSpot property `type`. HubSpot does
 * not publish a definitive operator/type matrix, so this is grounded in
 * observed behaviour (e.g. EQ works everywhere, IN is not valid for numbers)
 * and standard type semantics. Adjust here if HubSpot accepts a combination
 * this rejects. Unknown types fall back to the full operator list so a valid
 * query is never blocked.
 */
function operatorsForPropertyType(type: string | undefined): string[] {
	switch (type) {
		case 'number':
			return [...UNIVERSAL_OPERATORS, ...COMPARISON_OPERATORS];
		case 'date':
		case 'datetime':
			return [...UNIVERSAL_OPERATORS, ...COMPARISON_OPERATORS, ...LIST_OPERATORS];
		case 'enumeration':
			return [...UNIVERSAL_OPERATORS, ...LIST_OPERATORS];
		case 'bool':
			return [...UNIVERSAL_OPERATORS];
		case 'string':
		case 'phone_number':
			return [
				...UNIVERSAL_OPERATORS,
				...TOKEN_OPERATORS,
				...LIST_OPERATORS,
				...COMPARISON_OPERATORS,
			];
		default:
			// Unknown / unmapped type — allow everything.
			return SEARCH_OPERATORS.map((op) => op.value as string);
	}
}

/**
 * Operator options for a search filter, filtered to those valid for the
 * property selected in the same filter row. Association pseudo-properties
 * support equality and list membership. If the sibling property cannot be
 * resolved (older n8n versions may not pass it), the full list is returned.
 */
export async function getSearchOperators(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	let propertyName = '';
	try {
		propertyName = (this.getCurrentNodeParameter('&propertyName') as string) ?? '';
	} catch {
		propertyName = '';
	}

	// No property chosen yet — offer everything.
	if (!propertyName) return SEARCH_OPERATORS;

	// Has Property / Not Has Property are invalid for association
	// pseudo-properties — HubSpot rejects the request.
	if (propertyName.startsWith('associations.')) {
		const allowed = ['EQ', 'NEQ', ...LIST_OPERATORS];
		return SEARCH_OPERATORS.filter((op) => allowed.includes(op.value as string));
	}

	const properties = await fetchProperties.call(this);
	const match = properties.find((property) => property.name === propertyName);
	const allowed = operatorsForPropertyType(match?.type);

	return SEARCH_OPERATORS.filter((op) => allowed.includes(op.value as string));
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
