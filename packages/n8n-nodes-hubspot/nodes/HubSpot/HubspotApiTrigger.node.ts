import {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

import {
	CONTACTS_OBJECT_TYPE,
	getAllProperties,
	getSearchFilterProperties,
	getSearchOperators,
} from './helpers';
import {
	FilterGroup,
	UiFilterGroups,
	UiSorts,
	filterGroupsUiProperty,
	filterJsonProperty,
	propertiesProperty,
	resolveSearchInput,
	searchFilterModeProperty,
	sortsJsonOption,
	sortsUiOption,
	toStringList,
} from './searchFilter';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const OBJECTS_BASE_PATH = '/crm/v3/objects';

const BASE_HEADERS = {
	'content-type': 'application/json',
	accept: 'application/json',
};

const SEARCH_FILTER_MODE_DESCRIPTION =
	'How to define the search filters. Searches are not case-sensitive. During automatic polling a time-based filter is injected on top of whatever you provide; it is skipped for manual "fetch test event" runs so you can validate your filters.';

const SEARCH_FILTER_JSON_DESCRIPTION =
	'A JSON object containing <code>filterGroups</code>. Filter groups are OR\'d; filters within a group are AND\'d. During automatic polling a time-based filter is injected automatically (skipped for manual test runs). See <a href="https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/search/search-objects">HubSpot search docs</a> for operators: BETWEEN, CONTAINS_TOKEN, EQ, GT, GTE, HAS_PROPERTY, IN, LT, LTE, NEQ, NOT_CONTAINS_TOKEN, NOT_HAS_PROPERTY, NOT_IN.';

/** Formats an epoch-ms timestamp as an ISO 8601 string with the local UTC offset, e.g. 2026-07-21T21:17:08-04:00. */
function toIsoStringWithOffset(ms: number): string {
	const date = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');

	const offsetMinutes = -date.getTimezoneOffset();
	const offsetSign = offsetMinutes >= 0 ? '+' : '-';
	const absOffsetMinutes = Math.abs(offsetMinutes);

	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
		`${offsetSign}${pad(Math.floor(absOffsetMinutes / 60))}:${pad(absOffsetMinutes % 60)}`
	);
}

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
						name: 'Property Changed',
						value: 'propertyChanged',
						description:
							'Trigger only when one of the selected Trigger Properties changes value',
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

			// ── Trigger Properties (Property Changed mode) ──────────────────────────
			{
				// The dynamic-options "Names or IDs" convention is intentionally waived
				// to keep this label short next to "Trigger On".
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Trigger Properties',
				name: 'triggerProperties',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getAllProperties',
					loadOptionsDependsOn: ['objectType'],
				},
				default: [],
				description:
					'Fires when any one of these properties changes value. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: {
						triggerOn: ['propertyChanged'],
					},
				},
			},

			// ── Search Filter Mode + Filters (Fields / Custom JSON) ─────────────────
			// Hidden for Property Changed, where the equivalent fields live in
			// Additional Options instead — see below.
			searchFilterModeProperty(
				{ triggerOn: ['newOrUpdatedRecords', 'newRecords', 'updatedRecords'] },
				SEARCH_FILTER_MODE_DESCRIPTION,
			),

			filterGroupsUiProperty({
				triggerOn: ['newOrUpdatedRecords', 'newRecords', 'updatedRecords'],
			}),
			filterJsonProperty(
				{ triggerOn: ['newOrUpdatedRecords', 'newRecords', 'updatedRecords'] },
				SEARCH_FILTER_JSON_DESCRIPTION,
			),

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

			// ── Properties ──────────────────────────────────────────────────────────
			propertiesProperty({}),

			// ── Additional Options ────────────────────────────────────────────────
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					sortsUiOption,
					sortsJsonOption,
					// Filter Groups for Property Changed mode. Kept here (rather than
					// the main section) since this trigger mode's primary input is
					// Trigger Properties; filters just narrow which records qualify.
					// Wrapped in a single-instance fixedCollection so one "Add Option"
					// click reveals the mode toggle, Filter Groups, and Filters (JSON)
					// together — a bare `collection` would require adding each one
					// separately, even though only one of Filter Groups / Filters
					// (JSON) is ever relevant at a time.
					{
						displayName: 'Search Filters',
						name: 'searchFilters',
						type: 'fixedCollection',
						typeOptions: { multipleValues: false },
						placeholder: 'Add Search Filters',
						default: {},
						description: 'Optionally narrow which changed records qualify',
						displayOptions: {
							show: { '/triggerOn': ['propertyChanged'] },
						},
						options: [
							{
								name: 'filterConfig',
								displayName: 'Filters',
								values: [
									searchFilterModeProperty({}, SEARCH_FILTER_MODE_DESCRIPTION),
									filterGroupsUiProperty({}),
									filterJsonProperty({}, SEARCH_FILTER_JSON_DESCRIPTION),
								],
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getSearchFilterProperties,
			getSearchOperators,
			getAllProperties,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const staticData = this.getWorkflowStaticData('node');
		const now = Date.now();
		const lastPollTime = staticData.lastPollTime as number | undefined;
		const isManualMode = this.getMode() === 'manual';

		const objectType = this.getNodeParameter('objectType') as string;
		const triggerOn = this.getNodeParameter('triggerOn') as string;
		const isPropertyChangedMode = triggerOn === 'propertyChanged';
		const returnAllMode = this.getNodeParameter('returnAllMode') as string;
		const maxPages = Math.max(1, Math.floor(this.getNodeParameter('maxPages') as number));
		const propertiesList = toStringList(
			this.getNodeParameter('properties') as string | string[],
		);
		const additionalOptions = this.getNodeParameter('additionalOptions') as {
			sortsUi?: UiSorts;
			sortsJson?: string;
			searchFilters?: {
				filterConfig?: {
					searchInputMode?: string;
					filterGroupsUi?: UiFilterGroups;
					filterJson?: string;
				};
			};
		};
		const propertyChangedFilters = additionalOptions.searchFilters?.filterConfig ?? {};

		let triggerProperties: string[] = [];
		if (isPropertyChangedMode) {
			triggerProperties = toStringList(
				this.getNodeParameter('triggerProperties') as string | string[],
			);
			if (triggerProperties.length === 0) {
				throw new NodeApiError(this.getNode(), {
					message: 'Select at least one Trigger Property to watch for changes',
				} as JsonObject);
			}
		}

		// Gather the user-supplied filter groups, sorts, and any extra search-body
		// keys (e.g. query) from whichever input mode is active. Sorts always live
		// in Additional Options; for Property Changed the filters live there too
		// (see the property definitions above), since the main section is taken up
		// by Trigger Properties.
		const resolved = isPropertyChangedMode
			? resolveSearchInput({
					searchInputMode: propertyChangedFilters.searchInputMode ?? 'ui',
					filterJson: propertyChangedFilters.filterJson,
					filterGroupsUi: propertyChangedFilters.filterGroupsUi,
					sortsJson: additionalOptions.sortsJson,
					sortsUi: additionalOptions.sortsUi,
				})
			: resolveSearchInput({
					searchInputMode: this.getNodeParameter('searchInputMode') as string,
					filterJson: this.getNodeParameter('filterJson', '') as string,
					filterGroupsUi: this.getNodeParameter('filterGroupsUi', {}) as UiFilterGroups,
					sortsJson: additionalOptions.sortsJson,
					sortsUi: additionalOptions.sortsUi,
				});

		if (resolved.invalidFilterJson) {
			throw new NodeApiError(this.getNode(), {
				message: 'Filters (JSON) is not valid JSON',
			} as JsonObject);
		}
		if (resolved.invalidSortsJson) {
			throw new NodeApiError(this.getNode(), {
				message: 'Sorts (JSON) is not valid JSON',
			} as JsonObject);
		}

		const baseSearchBody = resolved.baseSearchBody;
		const userGroups = resolved.filterGroups;
		const userSorts = resolved.sorts;

		// Contacts predates HubSpot's unified hs_createdate / hs_lastmodifieddate
		// naming and only accepts the unprefixed createdate / lastmodifieddate as
		// search/sort properties; every other object type uses the hs_ versions.
		const isContacts = objectType === CONTACTS_OBJECT_TYPE;
		const createDateProperty = isContacts ? 'createdate' : 'hs_createdate';
		const lastModifiedDateProperty = isContacts ? 'lastmodifieddate' : 'hs_lastmodifieddate';

		const timeProperty = triggerOn === 'newRecords' ? createDateProperty : lastModifiedDateProperty;

		// Fall back to the previous minute only if static data is missing.
		const pollSince = lastPollTime ?? now - 60 * 1000;

		// The incremental time filter narrows each poll to records changed since
		// the last run. It is only applied during automatic (production) polling.
		// In manual mode ("fetch test event") we skip it entirely so the test
		// validates the user's own filters against all matching records rather
		// than just the last poll window.
		let mergedGroups: FilterGroup[];
		if (isManualMode) {
			mergedGroups = userGroups;
		} else {
			const timeFilter: JsonObject = {
				propertyName: timeProperty,
				operator: 'GTE',
				value: toIsoStringWithOffset(pollSince),
			};

			// Merge user filter groups with the time filter.
			// filterGroups are OR'd; filters within a group are AND'd — so we add
			// the time filter into each existing group to preserve the user's intent.
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
							propertyName: createDateProperty,
							operator: 'LT',
							value: toIsoStringWithOffset(pollSince),
						} as JsonObject,
					],
				}));
			}
		}

		const searchBody: JsonObject = {
			...baseSearchBody,
			filterGroups: mergedGroups,
			sorts: userSorts.length
				? userSorts
				: [{ propertyName: lastModifiedDateProperty, direction: 'DESCENDING' }],
			limit: 200,
			// For Property Changed, properties are fetched later via batch/read
			// alongside propertiesWithHistory, so the search step only needs IDs.
			...(propertiesList.length && !isPropertyChangedMode
				? { properties: propertiesList }
				: {}),
		};

		const searchUrl = `${HUBSPOT_BASE}${OBJECTS_BASE_PATH}/${objectType}/search`;

		// When n8n runs locally, log the exact request body sent to HubSpot to aid
		// debugging. Detected via the instance base URL so it never fires in prod.
		let debugLocalhost = false;
		try {
			debugLocalhost = /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(
				this.getInstanceBaseUrl(),
			);
		} catch {
			debugLocalhost = false;
		}

		const allResults: JsonObject[] = [];
		let after: string | undefined;
		let pageCount = 0;

		try {
			do {
				const pageBody: JsonObject = { ...searchBody, ...(after ? { after } : {}) };

				if (debugLocalhost) {
					this.logger.info(
						`[HubSpot Trigger] POST ${searchUrl}\n${JSON.stringify(pageBody, null, 2)}`,
					);
				}

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

		if (!isPropertyChangedMode) {
			if (returnAllMode === 'allInOne') {
				const outputItem: INodeExecutionData = { json: { results: allResults } };
				return [[outputItem]];
			}

			const outputItems: INodeExecutionData[] = allResults.map((result) => ({
				json: result,
			}));
			return [outputItems];
		}

		// ── Property Changed: confirm via property history ──────────────────────
		// The search above only narrows to records that changed *something* since
		// the last poll (hs_lastmodifieddate moves on any property write) — it has
		// no way to filter by *which* property changed. Each candidate is re-read
		// via batch/read with propertiesWithHistory, and only kept if one of the
		// watched properties actually changed within the poll window.
		const readProperties = Array.from(new Set([...propertiesList, ...triggerProperties]));
		const batchReadUrl = `${HUBSPOT_BASE}${OBJECTS_BASE_PATH}/${objectType}/batch/read`;

		interface PropertyHistoryEntry {
			value: string;
			timestamp: string;
			sourceType?: string;
		}
		interface BatchReadResult {
			id: string;
			properties: Record<string, string | null>;
			propertiesWithHistory?: Record<string, PropertyHistoryEntry[]>;
		}

		const matchedResults: JsonObject[] = [];

		try {
			// HubSpot caps batch/read inputs at 50 when propertiesWithHistory is requested.
			for (let i = 0; i < allResults.length; i += 50) {
				const chunk = allResults
					.slice(i, i + 50)
					.map((result) => ({ id: String(result.id) }));

				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'hubspotApi',
					{
						method: 'POST',
						url: batchReadUrl,
						headers: BASE_HEADERS,
						body: JSON.stringify({
							inputs: chunk,
							properties: readProperties,
							propertiesWithHistory: triggerProperties,
						}),
					},
				)) as { results?: BatchReadResult[] };

				for (const record of response.results ?? []) {
					const history = record.propertiesWithHistory ?? {};

					const changedProperties = triggerProperties
						.filter((propertyName) => (history[propertyName] ?? []).length > 0)
						.map((propertyName) => {
							const latest = history[propertyName][0];
							return { propertyName, value: latest.value, timestamp: latest.timestamp };
						})
						// In manual mode there is no poll window to compare against — any
						// prior change is enough to validate the property selection.
						.filter(
							(change) => isManualMode || new Date(change.timestamp).getTime() >= pollSince,
						);

					if (changedProperties.length === 0) continue;

					matchedResults.push({
						id: record.id,
						properties: record.properties,
						changedProperties,
					});
				}
			}
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}

		if (matchedResults.length === 0) return null;

		if (returnAllMode === 'allInOne') {
			return [[{ json: { results: matchedResults } }]];
		}

		return [matchedResults.map((result) => ({ json: result }))];
	}
}
