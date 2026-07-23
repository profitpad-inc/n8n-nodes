import { IDisplayOptions, INodeProperties, JsonObject } from 'n8n-workflow';

/**
 * Shared building blocks for the "search filter" UX (Fields / Custom JSON
 * filter builder, sorts, and a properties multi-select). Used by both the
 * HubSpot node's object Search operation and the HubSpot Trigger so the two
 * stay in lockstep.
 */

export type FilterGroup = { filters: JsonObject[] };

export interface UiFilter {
	propertyName?: string;
	operator?: string;
	value?: string;
	highValue?: string;
}
export interface UiFilterGroups {
	groups?: Array<{ filters?: { conditions?: UiFilter[] } }>;
}
export interface UiSorts {
	sortValues?: Array<{ propertyName?: string; direction?: string }>;
}

export const VALUELESS_OPERATORS = ['HAS_PROPERTY', 'NOT_HAS_PROPERTY'];

/** Convert a single UI filter row into a HubSpot search filter object. */
export function buildFilterFromUi(filter: UiFilter): JsonObject | null {
	const propertyName = (filter.propertyName ?? '').trim();
	if (!propertyName) return null;

	const operator = filter.operator ?? 'EQ';

	if (VALUELESS_OPERATORS.includes(operator)) {
		return { propertyName, operator };
	}

	const rawValue = (filter.value ?? '').trim();

	if (operator === 'IN' || operator === 'NOT_IN') {
		return {
			propertyName,
			operator,
			values: rawValue.split(';').map((s) => s.trim()).filter(Boolean),
		};
	}

	if (operator === 'BETWEEN') {
		return {
			propertyName,
			operator,
			value: rawValue,
			highValue: (filter.highValue ?? '').trim(),
		};
	}

	return { propertyName, operator, value: rawValue };
}

/** Build filterGroups (OR'd) from the Fields-mode UI. Empty groups are dropped. */
export function buildFilterGroupsFromUi(ui: UiFilterGroups): FilterGroup[] {
	return (ui.groups ?? [])
		.map((group) => ({
			filters: (group.filters?.conditions ?? [])
				.map(buildFilterFromUi)
				.filter((f): f is JsonObject => f !== null),
		}))
		.filter((group) => group.filters.length > 0);
}

/** Build a sorts array from the Fields-mode UI. */
export function buildSortsFromUi(ui: UiSorts): JsonObject[] {
	return (ui.sortValues ?? [])
		.filter((sort) => (sort.propertyName ?? '').trim())
		.map((sort) => ({
			propertyName: (sort.propertyName ?? '').trim(),
			direction: sort.direction ?? 'DESCENDING',
		}));
}

/**
 * Normalise a multiOptions value (array) or an expression-supplied
 * comma-separated string into a trimmed list of property names.
 */
export function toStringList(value: string | string[] | undefined): string[] {
	if (Array.isArray(value)) {
		return value.map((s) => String(s).trim()).filter(Boolean);
	}
	if (typeof value === 'string') {
		return value.split(',').map((s) => s.trim()).filter(Boolean);
	}
	return [];
}

// ── Property definition factories ─────────────────────────────────────────────
// The `baseShow` argument scopes each field to a resource/operation (empty for
// the single-operation Trigger). Definitions live here so the n8n lint rules
// still see the literals; hence the eslint-disable directives below.

type Show = NonNullable<IDisplayOptions['show']>;

const withBaseShow = (baseShow: Show, extra: Show = {}): { displayOptions?: IDisplayOptions } => {
	const show = { ...baseShow, ...extra };
	return Object.keys(show).length ? { displayOptions: { show } } : {};
};

/** The Fields / Custom JSON toggle. */
export function searchFilterModeProperty(baseShow: Show, description: string): INodeProperties {
	return {
		displayName: 'Search Filter Mode',
		name: 'searchInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Custom JSON',
				value: 'json',
				description: 'Provide raw filterGroups and sorts as JSON',
			},
			{
				name: 'Fields',
				value: 'ui',
				description: 'Build filters and sorts with guided fields',
			},
		],
		default: 'ui',
		description,
		...withBaseShow(baseShow),
	};
}

/** The Fields-mode AND/OR filter builder. */
export function filterGroupsUiProperty(baseShow: Show): INodeProperties {
	return {
		displayName: 'Filter Groups',
		name: 'filterGroupsUi',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Filter Group',
		default: {},
		description:
			'Filter groups are combined with OR — a record matches if it satisfies any group. Filters within a group are combined with AND. To match records linked to another record, pick an association property (e.g. <em>associations.0-1</em>) and set the value to the associated record ID.',
		...withBaseShow(baseShow, { searchInputMode: ['ui'] }),
		options: [
			{
				name: 'groups',
				displayName: 'Filter Group (OR)',
				values: [
					{
						displayName: 'Filters (AND)',
						name: 'filters',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						placeholder: 'Add Filter',
						default: {},
						options: [
							{
								name: 'conditions',
								displayName: 'Filter',
								values: [
									{
										// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
										displayName: 'Property',
										name: 'propertyName',
										type: 'options',
										typeOptions: {
											loadOptionsMethod: 'getSearchFilterProperties',
											loadOptionsDependsOn: ['objectType'],
										},
										default: '',
										description:
											'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
									},
									{
										// Operator values are a fixed HubSpot enum, not fetched
										// resources, so the dynamic-options naming/description
										// lint conventions do not apply here.
										// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
										displayName: 'Operator',
										name: 'operator',
										type: 'options',
										typeOptions: {
											loadOptionsMethod: 'getSearchOperators',
											loadOptionsDependsOn: ['&propertyName'],
										},
										default: 'EQ',
										// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
										description:
											'How to compare the property against the value. Only operators valid for the selected property\'s type are shown.',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description:
											'The value to compare against. For <em>In List</em> / <em>Not In List</em>, provide a semicolon-separated list. For <em>Between</em>, this is the lower bound.',
										displayOptions: {
											hide: {
												operator: VALUELESS_OPERATORS,
											},
										},
									},
									{
										displayName: 'High Value',
										name: 'highValue',
										type: 'string',
										default: '',
										description: 'The upper bound for the <em>Between</em> operator',
										displayOptions: {
											show: {
												operator: ['BETWEEN'],
											},
										},
									},
								],
							},
						],
					},
				],
			},
		],
	};
}

/** The Custom JSON filter body. */
export function filterJsonProperty(baseShow: Show, description: string): INodeProperties {
	return {
		displayName: 'Filters (JSON)',
		name: 'filterJson',
		type: 'json',
		default: JSON.stringify(
			{
				filterGroups: [
					{
						filters: [
							{
								propertyName: 'email',
								operator: 'EQ',
								value: 'john@example.com',
							},
						],
					},
				],
			},
			null,
			2,
		),
		description,
		...withBaseShow(baseShow, { searchInputMode: ['json'] }),
	};
}

/** Top-level Properties multi-select. */
export function propertiesProperty(baseShow: Show): INodeProperties {
	return {
		// Keep the concise "Properties" label; the dynamic-options "Names or IDs"
		// convention is intentionally waived for this field.
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
		displayName: 'Properties',
		name: 'properties',
		type: 'multiOptions',
		typeOptions: {
			loadOptionsMethod: 'getAllProperties',
			loadOptionsDependsOn: ['objectType'],
		},
		default: [],
		description:
			'Properties to include in each returned record. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		...withBaseShow(baseShow),
	};
}

/**
 * Sorts options for an Additional Options collection. They toggle on the
 * node-level `searchInputMode` via a root reference, so they can be dropped
 * straight into any collection.
 */
export const sortsUiOption: INodeProperties = {
	displayName: 'Sorts',
	name: 'sortsUi',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Sort',
	default: {},
	description:
		'How to order results. When left empty, results are sorted by hs_lastmodifieddate descending.',
	displayOptions: {
		show: {
			'/searchInputMode': ['ui'],
		},
	},
	options: [
		{
			name: 'sortValues',
			displayName: 'Sort',
			values: [
				{
					// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
					displayName: 'Property',
					name: 'propertyName',
					type: 'options',
					typeOptions: {
						loadOptionsMethod: 'getAllProperties',
						loadOptionsDependsOn: ['objectType'],
					},
					default: 'hs_lastmodifieddate',
					description:
						'The property to sort by. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				},
				{
					displayName: 'Direction',
					name: 'direction',
					type: 'options',
					options: [
						{ name: 'Ascending', value: 'ASCENDING' },
						{ name: 'Descending', value: 'DESCENDING' },
					],
					default: 'DESCENDING',
					description: 'The sort direction',
				},
			],
		},
	],
};

export const sortsJsonOption: INodeProperties = {
	displayName: 'Sorts (JSON)',
	name: 'sortsJson',
	type: 'json',
	default: JSON.stringify(
		{
			sorts: [
				{
					propertyName: 'hs_lastmodifieddate',
					direction: 'DESCENDING',
				},
			],
		},
		null,
		2,
	),
	description:
		'A JSON object containing a <code>sorts</code> array. When omitted, results are sorted by hs_lastmodifieddate descending.',
	displayOptions: {
		show: {
			'/searchInputMode': ['json'],
		},
	},
};

/**
 * Resolve the effective filterGroups, sorts, and any extra search-body keys
 * (e.g. query) from the node parameters, honouring the Fields / Custom JSON
 * toggle. `getParam` reads a node parameter by name; `sorts` reads the sort
 * inputs which live inside an Additional Options collection.
 */
export interface ResolvedSearchInput {
	baseSearchBody: JsonObject;
	filterGroups: FilterGroup[];
	sorts: JsonObject[];
	invalidFilterJson: boolean;
	invalidSortsJson: boolean;
}

export function resolveSearchInput(params: {
	searchInputMode: string;
	filterJson?: string;
	filterGroupsUi?: UiFilterGroups;
	sortsJson?: string;
	sortsUi?: UiSorts;
}): ResolvedSearchInput {
	const result: ResolvedSearchInput = {
		baseSearchBody: {},
		filterGroups: [],
		sorts: [],
		invalidFilterJson: false,
		invalidSortsJson: false,
	};

	if (params.searchInputMode === 'json') {
		const trimmedFilter = (params.filterJson ?? '').trim();
		if (trimmedFilter && trimmedFilter !== '{}') {
			try {
				result.baseSearchBody = JSON.parse(trimmedFilter) as JsonObject;
			} catch {
				result.invalidFilterJson = true;
			}
		}
		result.filterGroups =
			(result.baseSearchBody.filterGroups as FilterGroup[] | undefined) ?? [];

		const trimmedSorts = (params.sortsJson ?? '').trim();
		if (trimmedSorts && trimmedSorts !== '{}') {
			try {
				const parsed = JSON.parse(trimmedSorts) as JsonObject;
				result.sorts = (parsed.sorts as JsonObject[] | undefined) ?? [];
			} catch {
				result.invalidSortsJson = true;
			}
		} else {
			// No separate Sorts (JSON) option set — honour a `sorts` array
			// embedded directly in the pasted/legacy body instead of silently
			// dropping it in favour of the default sort.
			result.sorts = (result.baseSearchBody.sorts as JsonObject[] | undefined) ?? [];
		}
	} else {
		result.filterGroups = buildFilterGroupsFromUi(params.filterGroupsUi ?? {});
		result.sorts = buildSortsFromUi(params.sortsUi ?? {});
	}

	return result;
}
