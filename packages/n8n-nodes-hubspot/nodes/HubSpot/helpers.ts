import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const PROPERTIES_BASE_PATH = '/crm/properties/2026-03';

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
