import { IDisplayOptions, INodeProperties, JsonObject } from 'n8n-workflow';

/**
 * Shared building blocks for the "search filter" UX (Fields / Custom JSON
 * filter builder, sorts, and a properties multi-select). Used by both the
 * HubSpot node's object Search operation and the HubSpot Trigger so the two
 * stay in lockstep.
 */

export type FilterGroup = { filters: JsonObject[] };

export interface UiFilter {
	propertyName?: string | number;
	operator?: string;
	value?: string | number;
	highValue?: string | number;
}
export interface UiFilterGroups {
	groups?: Array<{ filters?: { conditions?: UiFilter[] } }>;
}
export interface UiSorts {
	sortValues?: Array<{ propertyName?: string | number; direction?: string }>;
}

export const VALUELESS_OPERATORS = ['HAS_PROPERTY', 'NOT_HAS_PROPERTY'];

/**
 * Single-bound comparison operators whose value is converted to epoch millis,
 * but only for `date` properties (Between converts for any property).
 */
export const DATE_COMPARISON_OPERATORS = ['GT', 'GTE', 'LT', 'LTE'];

/**
 * Whether any Fields-mode filter uses a single-bound comparison operator, i.e.
 * whether the caller needs to look up which properties are of type `date`.
 */
export function uiFiltersNeedDateProperties(ui: UiFilterGroups | undefined): boolean {
	return (ui?.groups ?? []).some((group) =>
		(group.filters?.conditions ?? []).some((filter) =>
			DATE_COMPARISON_OPERATORS.includes(filter.operator ?? ''),
		),
	);
}

/**
 * Trim a UI-supplied value. Expressions can resolve to numbers (or other
 * non-string types) even though the field is declared as a string, so this
 * coerces to a string first rather than assuming `.trim()` is available.
 */
function trimmed(value: string | number | undefined | null): string {
	if (value === undefined || value === null) return '';
	return (typeof value === 'number' ? String(value) : value).trim();
}

const DATE_LIKE_PATTERN =
	/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * Convert a date-like Between bound to epoch milliseconds, which is what
 * HubSpot expects for date/datetime properties. Accepts `YYYY-MM-DD`
 * (midnight UTC) and ISO date-times with or without an offset; a date-time
 * with no offset is read as UTC rather than the server's local time zone.
 * Anything else (already-millis numbers, plain text) is returned unchanged.
 * With `endOfDay` (Between's High Value, and LTE), a bare `YYYY-MM-DD`
 * becomes 23:59:59.999 UTC instead, so an inclusive upper bound covers that
 * whole day; date-times are left exact.
 */
export function dateLikeToMillis(value: string, endOfDay = false): string {
	const match = DATE_LIKE_PATTERN.exec(value);
	if (!match) return value;
	let iso = value.replace(' ', 'T');
	const dateOnly = !iso.includes('T');
	if (dateOnly) iso += endOfDay ? 'T23:59:59.999' : 'T00:00:00';
	if (!match[1]) iso += 'Z';
	const millis = Date.parse(iso);
	return Number.isNaN(millis) ? value : String(millis);
}

/**
 * Convert a single UI filter row into a HubSpot search filter object.
 * `dateProperties` names the properties of type `date`, whose GT/GTE/LT/LTE
 * values get the same date-to-millis conversion as Between bounds.
 */
export function buildFilterFromUi(
	filter: UiFilter,
	dateProperties: ReadonlySet<string> = new Set(),
): JsonObject | null {
	const propertyName = trimmed(filter.propertyName);
	if (!propertyName) return null;

	const operator = filter.operator ?? 'EQ';

	if (VALUELESS_OPERATORS.includes(operator)) {
		return { propertyName, operator };
	}

	const rawValue = trimmed(filter.value);

	if (operator === 'IN' || operator === 'NOT_IN') {
		return {
			propertyName,
			operator,
			values: rawValue
				.split(';')
				.map((s) => s.trim())
				.filter(Boolean),
		};
	}

	if (operator === 'BETWEEN') {
		return {
			propertyName,
			operator,
			value: dateLikeToMillis(rawValue),
			highValue: dateLikeToMillis(trimmed(filter.highValue), true),
		};
	}

	if (DATE_COMPARISON_OPERATORS.includes(operator) && dateProperties.has(propertyName)) {
		return { propertyName, operator, value: dateLikeToMillis(rawValue, operator === 'LTE') };
	}

	return { propertyName, operator, value: rawValue };
}

/** Build filterGroups (OR'd) from the Fields-mode UI. Empty groups are dropped. */
export function buildFilterGroupsFromUi(
	ui: UiFilterGroups,
	dateProperties: ReadonlySet<string> = new Set(),
): FilterGroup[] {
	return (ui.groups ?? [])
		.map((group) => ({
			filters: (group.filters?.conditions ?? [])
				.map((filter) => buildFilterFromUi(filter, dateProperties))
				.filter((f): f is JsonObject => f !== null),
		}))
		.filter((group) => group.filters.length > 0);
}

/** Build a sorts array from the Fields-mode UI. */
export function buildSortsFromUi(ui: UiSorts): JsonObject[] {
	return (ui.sortValues ?? [])
		.filter((sort) => trimmed(sort.propertyName))
		.map((sort) => ({
			propertyName: trimmed(sort.propertyName),
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
		return value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
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

/**
 * The Fields-mode AND/OR filter builder, for the CRM-object Search operation
 * (property/operator options resolved from the primary `objectType`
 * parameter). The Owners resource's Users search has its own copy of this
 * shape in OwnerDescription.ts with different loadOptions methods baked in
 * literally — n8n's eslint rules for dynamic-options fields only recognise a
 * `loadOptionsMethod` that is a string literal in the AST, so parameterising
 * it here would silently defeat those rules (confirmed by lint output) rather
 * than genuinely share the definition.
 */
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
											"How to compare the property against the value. Only operators valid for the selected property's type are shown.",
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description:
											'The value to compare against. For <em>In List</em> / <em>Not In List</em>, provide a semicolon-separated list. For <em>Between</em>, this is the lower bound. For <em>Between</em> (any property) and <em>Greater/Less Than (or Equal)</em> on date-only properties, a date such as 2026-08-01 or an ISO date-time is converted to epoch milliseconds (UTC when no offset is given). A plain date means the start of that day, except with <em>Less Than or Equal</em> on a date property, where it means the end of that day (23:59:59.999 UTC).',
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
										description:
											'The upper bound for the <em>Between</em> operator. A plain date such as 2026-08-31 means the end of that day (23:59:59.999 UTC), so the whole day is included, the same as <em>Less Than or Equal</em> on a date property. An ISO date-time is converted as-is (UTC when no offset is given).',
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
 * Sorts options for an Additional Options collection, for the CRM-object
 * Search operation and the Trigger. They toggle on the node-level
 * `searchInputMode` via a root reference, so they can be dropped straight
 * into any collection. The Owners resource's Users search has its own copy
 * with a different loadOptions method baked in literally — see the note on
 * filterGroupsUiProperty above for why this isn't parameterised instead.
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
	/** Properties of type `date`, from getDatePropertyNames(); Fields mode only. */
	dateProperties?: ReadonlySet<string>;
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
		result.filterGroups = (result.baseSearchBody.filterGroups as FilterGroup[] | undefined) ?? [];

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
		result.filterGroups = buildFilterGroupsFromUi(
			params.filterGroupsUi ?? {},
			params.dateProperties,
		);
		result.sorts = buildSortsFromUi(params.sortsUi ?? {});
	}

	return result;
}
