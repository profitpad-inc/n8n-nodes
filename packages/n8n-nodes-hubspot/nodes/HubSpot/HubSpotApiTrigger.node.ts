import {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const OBJECTS_BASE_PATH = '/crm/v3/objects';

const BASE_HEADERS = {
	'content-type': 'application/json',
	accept: 'application/json',
};

export class HubspotApiTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HubSpot Trigger',
		name: 'hubspotApiTrigger',
		icon: 'file:app-icon.svg',
		group: ['trigger'],
		version: 1,
		description:
			'Polls for new or updated HubSpot records on a schedule using search filters.',
		subtitle: '={{$parameter["objectType"] + " – " + $parameter["triggerOn"]}}',
		defaults: {
			name: 'HubSpot Trigger',
		},
		polling: true,
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'hubspotApi',
				required: true,
			},
		],
		properties: [
			// ── Object Type ───────────────────────────────────────────────────────
			{
				displayName: 'Object Type',
				name: 'objectType',
				type: 'options',
				typeOptions: { noValidation: true },
				options: [
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
				],
				default: '0-1',
				description: 'The HubSpot CRM object type to watch for changes',
			},

			// ── Trigger On ────────────────────────────────────────────────────────
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				options: [
					{
						name: 'New or Updated Records',
						value: 'newOrUpdatedRecords',
						description: 'Trigger when records are created or updated',
					},
					{
						name: 'New Records',
						value: 'newRecords',
						description: 'Trigger only when records are created',
					},
					{
						name: 'Updated Records',
						value: 'updatedRecords',
						description: 'Trigger only when existing records are updated',
					},
				],
				default: 'newOrUpdatedRecords',
				description: 'Which type of record change should fire the trigger',
			},

			// ── Search Body ───────────────────────────────────────────────────────
			{
				displayName: 'Search Body',
				name: 'searchBody',
				type: 'json',
				default: '{}',
				description:
					'Optional additional filters as a JSON object — the time-based filter is injected automatically. See <a href="https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/search/search-objects">HubSpot search docs</a> for available operators: BETWEEN, CONTAINS_TOKEN, EQ, GT, GTE, HAS_PROPERTY, IN, LT, LTE, NEQ, NOT_CONTAINS_TOKEN, NOT_HAS_PROPERTY, NOT_IN.',
			},

			// ── Return Mode ───────────────────────────────────────────────────────
			{
				displayName: 'Return Mode',
				name: 'returnAllMode',
				type: 'options',
				noDataExpression: true,
				default: 'eachResult',
				description: 'How to output the fetched results',
				options: [
					{
						name: 'All Results as 1 Item',
						value: 'allInOne',
						description:
							'Aggregate all new records and return them combined in a single output item',
					},
					{
						name: 'Each Result as 1 Item',
						value: 'eachResult',
						description: 'Return each individual record as a separate output item',
					},
				],
			},

			// ── Max Pages ─────────────────────────────────────────────────────────
			{
				displayName: 'Max Pages Per Poll',
				name: 'maxPages',
				type: 'number',
				typeOptions: { minValue: 1, numberPrecision: 0 },
				default: 10,
				description:
					'Maximum number of search result pages to fetch per poll cycle. Each page contains up to 200 records.',
			},

			// ── Additional Options ────────────────────────────────────────────────
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Properties',
						name: 'properties',
						type: 'string',
						default: '',
						placeholder: 'email,firstname,lastname',
						description:
							'Comma-separated list of property names to include in each returned record',
					},
					{
						displayName: 'Properties With History',
						name: 'propertiesWithHistory',
						type: 'string',
						default: '',
						placeholder: 'email,phone',
						description:
							'Comma-separated list of properties to return along with their historical values',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const staticData = this.getWorkflowStaticData('node');
		const now = Date.now();
		const lastPollTime = staticData.lastPollTime as number | undefined;
		const isManualMode = this.getMode() === 'manual';

		const objectType = this.getNodeParameter('objectType') as string;
		const triggerOn = this.getNodeParameter('triggerOn') as string;
		const searchBodyRaw = this.getNodeParameter('searchBody') as string;
		const returnAllMode = this.getNodeParameter('returnAllMode') as string;
		const maxPages = Math.max(1, Math.floor(this.getNodeParameter('maxPages') as number));
		const additionalOptions = this.getNodeParameter('additionalOptions') as {
			properties?: string;
			propertiesWithHistory?: string;
		};

		// Parse optional user-supplied search body
		let baseSearchBody: JsonObject = {};
		const trimmedBody = (searchBodyRaw ?? '').trim();
		if (trimmedBody && trimmedBody !== '{}') {
			try {
				baseSearchBody = JSON.parse(trimmedBody) as JsonObject;
			} catch {
				throw new NodeApiError(this.getNode(), {
					message: 'Search Body is not valid JSON',
				} as JsonObject);
			}
		}

		// On the first manual run use the past 24 h as a lookback window so
		// the user sees representative results. In automatic mode, fall back to
		// the previous minute only if static data is somehow missing.
		const pollSince =
			lastPollTime ??
			(isManualMode ? now - 24 * 60 * 60 * 1000 : now - 60 * 1000);

		const timeProperty =
			triggerOn === 'newRecords' ? 'createdate' : 'lastmodifieddate';

		const timeFilter: JsonObject = {
			propertyName: timeProperty,
			operator: 'GTE',
			value: String(pollSince),
		};

		// Merge user filter groups with the time filter.
		// filterGroups are OR'd; filters within a group are AND'd — so we add
		// the time filter into each existing group to preserve the user's intent.
		type FilterGroup = { filters: JsonObject[] };
		const userGroups =
			(baseSearchBody.filterGroups as FilterGroup[] | undefined) ?? [];

		let mergedGroups: FilterGroup[];
		if (userGroups.length > 0) {
			mergedGroups = userGroups.map((group) => ({
				...group,
				filters: [...(group.filters ?? []), timeFilter],
			}));
		} else {
			mergedGroups = [{ filters: [timeFilter] }];
		}

		// For "updatedRecords" also exclude records that were created within the
		// poll window (those are "new", not "updated").
		if (triggerOn === 'updatedRecords') {
			mergedGroups = mergedGroups.map((group) => ({
				...group,
				filters: [
					...group.filters,
					{
						propertyName: 'createdate',
						operator: 'LT',
						value: String(pollSince),
					} as JsonObject,
				],
			}));
		}

		const propertiesList = additionalOptions.properties
			? additionalOptions.properties
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: undefined;
		const propertiesWithHistoryList = additionalOptions.propertiesWithHistory
			? additionalOptions.propertiesWithHistory
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: undefined;

		const searchBody: JsonObject = {
			...baseSearchBody,
			filterGroups: mergedGroups,
			sorts: (baseSearchBody.sorts as JsonObject[] | undefined) ?? [
				{ propertyName: timeProperty, direction: 'ASCENDING' },
			],
			limit: 200,
			...(propertiesList?.length ? { properties: propertiesList } : {}),
			...(propertiesWithHistoryList?.length
				? { propertiesWithHistory: propertiesWithHistoryList }
				: {}),
		};

		const searchUrl = `${HUBSPOT_BASE}${OBJECTS_BASE_PATH}/${objectType}/search`;
		const allResults: JsonObject[] = [];
		let after: string | undefined;
		let pageCount = 0;

		try {
			do {
				const pageBody: JsonObject = { ...searchBody, ...(after ? { after } : {}) };
				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'hubspotApi',
					{
						method: 'POST',
						url: searchUrl,
						headers: BASE_HEADERS,
						body: JSON.stringify(pageBody),
					},
				)) as JsonObject;

				const results = (response.results as JsonObject[] | undefined) ?? [];
				allResults.push(...results);

				pageCount++;
				const paging = response.paging as JsonObject | undefined;
				after = (paging?.next as JsonObject | undefined)?.after as
					| string
					| undefined;
			} while (after && pageCount < maxPages);
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}

		staticData.lastPollTime = now;

		if (allResults.length === 0) return null;

		if (returnAllMode === 'allInOne') {
			const outputItem: INodeExecutionData = { json: { results: allResults } };
			return [[outputItem]];
		}

		const outputItems: INodeExecutionData[] = allResults.map((result) => ({
			json: result,
		}));
		return [outputItems];
	}
}
