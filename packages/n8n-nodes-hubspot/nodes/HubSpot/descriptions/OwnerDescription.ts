import { INodeProperties } from 'n8n-workflow';

import {
	filterJsonProperty,
	searchFilterModeProperty,
	sortsJsonOption,
	VALUELESS_OPERATORS,
} from '../searchFilter';

const SEARCH_SHOW = { resource: ['owners'], objectType: ['users'], operation: ['search'] };

const SEARCH_FILTER_MODE_DESCRIPTION =
	'How to define the search filters. Searches are not case-sensitive.';

const SEARCH_FILTER_JSON_DESCRIPTION =
	'A JSON object containing <code>filterGroups</code> (and optionally <code>query</code>). Filter groups are OR\'d; filters within a group are AND\'d. See <a href="https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/search/search-objects">HubSpot search docs</a> for operators: BETWEEN, CONTAINS_TOKEN, EQ, GT, GTE, HAS_PROPERTY, IN, LT, LTE, NEQ, NOT_CONTAINS_TOKEN, NOT_HAS_PROPERTY, NOT_IN.';

// Own copy of searchFilter.ts's filterGroupsUiProperty()/sortsUiOption, with
// 'getUserProperties'/'getUserSearchOperators' baked in literally instead of
// the CRM-object variants ('getSearchFilterProperties'/'getSearchOperators',
// keyed off the primary `objectType` parameter — which for this resource
// holds 'users'/'owners', not a real object type). n8n's eslint rules for
// dynamic-options fields only recognise a `loadOptionsMethod` that is a
// string literal in the AST, so this can't be shared via a parameterised
// function without silently defeating those rules (confirmed by lint output).
const userFilterGroupsUiProperty: INodeProperties = {
	displayName: 'Filter Groups',
	name: 'filterGroupsUi',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Filter Group',
	default: {},
	description:
		'Filter groups are combined with OR — a record matches if it satisfies any group. Filters within a group are combined with AND.',
	displayOptions: {
		show: { ...SEARCH_SHOW, searchInputMode: ['ui'] },
	},
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
										loadOptionsMethod: 'getUserProperties',
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
										loadOptionsMethod: 'getUserSearchOperators',
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
										'The value to compare against. For <em>In List</em> / <em>Not In List</em>, provide a semicolon-separated list. For <em>Between</em>, this is the lower bound.',
									displayOptions: {
										hide: { operator: VALUELESS_OPERATORS },
									},
								},
								{
									displayName: 'High Value',
									name: 'highValue',
									type: 'string',
									default: '',
									description: 'The upper bound for the <em>Between</em> operator',
									displayOptions: {
										show: { operator: ['BETWEEN'] },
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

const userSortsUiOption: INodeProperties = {
	displayName: 'Sorts',
	name: 'sortsUi',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Sort',
	default: {},
	description:
		'How to order results. When left empty, results are sorted by hs_lastmodifieddate descending.',
	displayOptions: {
		show: { '/searchInputMode': ['ui'] },
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
						loadOptionsMethod: 'getUserProperties',
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

const msOption: INodeProperties = {
	displayName: 'Milliseconds Between Items',
	name: 'millisecondsBetweenItems',
	type: 'number',
	default: 50,
	typeOptions: { minValue: 0 },
	description:
		'How long to wait between processing each input item, in milliseconds. Useful for avoiding HubSpot rate limits.',
};

// Only applies to the Owners object type; the Users variants of each
// collection below simply omit this option instead of using displayOptions,
// since n8n cannot resolve displayOptions on a child of a collection/
// fixedCollection.
const archivedOption: INodeProperties = {
	displayName: 'Archived',
	name: 'archived',
	type: 'boolean',
	default: false,
	description: 'Whether to include archived records in the response',
};

const errorWhenNotFoundOption: INodeProperties = {
	displayName: 'Error When Not Found',
	name: 'errorWhenNotFound',
	type: 'boolean',
	default: true,
	description:
		'Whether to throw an error if nothing is found, instead of returning a result indicating nothing was found',
};

// Only applies to the Users object type; see the note on archivedOption above
// for why this is handled by omission rather than displayOptions.
const propertiesOption: INodeProperties = {
	// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
	displayName: 'Properties',
	name: 'properties',
	type: 'multiOptions',
	typeOptions: {
		loadOptionsMethod: 'getUserProperties',
	},
	default: [],
	description:
		'Properties to return. Returns all simple properties when left blank. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

const propertiesWithHistoryOption: INodeProperties = {
	displayName: 'Properties With History',
	name: 'propertiesWithHistory',
	type: 'multiOptions',
	typeOptions: {
		loadOptionsMethod: 'getUserProperties',
	},
	default: [],
	description:
		'Properties to return along with their historical values. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

export const ownerDescription: INodeProperties[] = [
	// ── Object Type ───────────────────────────────────────────────────────────
	{
		displayName: 'Object Type',
		name: 'objectType',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['owners'],
			},
		},
		options: [
			{
				name: 'Users',
				value: 'users',
				description: 'HubSpot user records (job title, timezone, working hours, etc.)',
			},
			{
				name: 'Owners',
				value: 'owners',
				description: 'Read-only owner records used to assign CRM records to a person',
			},
		],
		default: 'users',
	},

	// ── Operation (Users — List, Get, Search, Update) ─────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['users'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single user',
				action: 'Get a user',
			},
			{
				name: 'List',
				value: 'list',
				description: 'List users',
				action: 'List users',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search for users using filters',
				action: 'Search users',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing user',
				action: 'Update a user',
			},
		],
		default: 'list',
	},

	// ── Operation (Owners — List, Get only) ───────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['owners'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single owner',
				action: 'Get an owner',
			},
			{
				name: 'List',
				value: 'list',
				description: 'List owners',
				action: 'List owners',
			},
		],
		default: 'list',
	},

	// ── ID Property (Users — Get, Update) ──────────────────────────────────────
	{
		displayName: 'ID Property',
		name: 'idProperty',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['users'],
				operation: ['get', 'update'],
			},
		},
		options: [
			{
				name: 'User ID',
				value: 'userId',
				description: 'The HubSpot CRM user ID (default)',
			},
			{
				name: 'Owner ID',
				value: 'ownerId',
				description:
					'The HubSpot owner ID. Resolved to a user ID via an extra call to the Owners API before the user is fetched or updated.',
			},
			{
				name: 'Email',
				value: 'email',
				description: "The user's email address",
			},
		],
		default: 'userId',
		description:
			'Which field <em>Object ID</em> refers to. Switch to an <a href="https://docs.n8n.io/code/expressions/">expression</a> to type any other internal property name.',
	},

	// ── ID Property (Owners — Get) ─────────────────────────────────────────────
	{
		displayName: 'ID Property',
		name: 'idProperty',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['owners'],
				operation: ['get'],
			},
		},
		options: [
			{
				name: 'Owner ID',
				value: 'ownerId',
				description: 'The HubSpot owner ID (default)',
			},
			{
				name: 'User ID',
				value: 'userId',
				description:
					'The HubSpot CRM user ID. Owners are paged through to find a match, since the Owners API only supports direct lookup by owner ID.',
			},
			{
				name: 'Email',
				value: 'email',
				description:
					"The owner's email address. Owners are paged through to find a match, since the Owners API only supports direct lookup by owner ID.",
			},
		],
		default: 'ownerId',
		description:
			'Which field <em>Object ID</em> refers to. Switch to an <a href="https://docs.n8n.io/code/expressions/">expression</a> to type any other field returned by the Owners API.',
	},

	// ── Object ID (Get, Update) ────────────────────────────────────────────────
	{
		displayName: 'Object ID',
		name: 'objectId',
		type: 'string',
		required: true,
		default: '',
		description: 'The value of the field selected in <em>ID Property</em>',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['get', 'update'],
			},
		},
	},

	// ── GET additional options (Users) ────────────────────────────────────────
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['users'],
				operation: ['get'],
			},
		},
		options: [errorWhenNotFoundOption, msOption, propertiesOption, propertiesWithHistoryOption],
	},

	// ── GET additional options (Owners) ───────────────────────────────────────
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['owners'],
				operation: ['get'],
			},
		},
		options: [archivedOption, errorWhenNotFoundOption, msOption],
	},

	// ── LIST ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['list', 'search'],
			},
		},
	},
	{
		displayName: 'Return All Mode',
		name: 'returnAllMode',
		type: 'options',
		noDataExpression: true,
		default: 'eachResult',
		description: 'How to output the fetched results',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['list', 'search'],
				returnAll: [true],
			},
		},
		options: [
			{
				name: 'All Results as 1 Item',
				value: 'allInOne',
				description: 'Aggregate all pages and return every result combined in a single output item',
			},
			{
				name: 'Each Page as 1 Item',
				value: 'eachPage',
				description: 'Return each API page response as a separate output item',
			},
			{
				name: 'Each Result as 1 Item',
				value: 'eachResult',
				description: 'Return each individual record as a separate output item',
			},
		],
	},
	{
		displayName: 'Max Pages',
		name: 'maxPages',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 10,
		description: 'Maximum number of pages to fetch. Each page contains up to 100 results.',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['list'],
				returnAll: [true],
			},
		},
	},
	{
		displayName: 'Max Pages',
		name: 'maxPages',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 10,
		description: 'Maximum number of pages to fetch. Each page contains up to 200 results.',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['search'],
				returnAll: [true],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit
		default: 100,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['list', 'search'],
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'listOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['users'],
				operation: ['list'],
			},
		},
		options: [
			{
				displayName: 'After (Cursor)',
				name: 'after',
				type: 'string',
				default: '',
				description:
					'Pagination cursor returned by a previous response, used to fetch the next page when not using Return All',
			},
			msOption,
			propertiesOption,
			propertiesWithHistoryOption,
		],
	},
	{
		displayName: 'Additional Options',
		name: 'listOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				objectType: ['owners'],
				operation: ['list'],
			},
		},
		options: [
			{
				displayName: 'After (Cursor)',
				name: 'after',
				type: 'string',
				default: '',
				description:
					'Pagination cursor returned by a previous response, used to fetch the next page when not using Return All',
			},
			archivedOption,
			msOption,
		],
	},

	// ── SEARCH (Users only — the Owners API has no search endpoint) ────────────
	searchFilterModeProperty(SEARCH_SHOW, SEARCH_FILTER_MODE_DESCRIPTION),
	userFilterGroupsUiProperty,
	filterJsonProperty(SEARCH_SHOW, SEARCH_FILTER_JSON_DESCRIPTION),
	{
		displayName: 'Additional Options',
		name: 'searchOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['search'],
			},
		},
		options: [
			errorWhenNotFoundOption,
			msOption,
			propertiesOption,
			propertiesWithHistoryOption,
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				description:
					"Free-text search string matched across the user's default searchable properties",
			},
			userSortsUiOption,
			sortsJsonOption,
		],
	},

	// ── UPDATE (Users only) ─────────────────────────────────────────────────────
	{
		displayName: 'Input Mode',
		name: 'updateInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Custom JSON',
				value: 'json',
				description: 'Provide a raw JSON patch (merged on top of existing data)',
			},
			{
				name: 'Fields',
				value: 'ui',
				description: 'Fill in individual fields',
			},
		],
		default: 'ui',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Properties',
		name: 'updateFields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
			fixedCollection: { itemTitle: '={{$collection.item.value.name}}' },
		},
		placeholder: 'Add Property',
		default: {},
		description:
			'User properties to update. Use HubSpot internal property names (e.g. <em>hs_job_title</em>).',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['update'],
				updateInputMode: ['ui'],
			},
		},
		options: [
			{
				name: 'propertyValues',
				displayName: 'Property',
				values: [
					{
						// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
						displayName: 'Property',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getWritableUserProperties',
						},
						default: '',
						description:
							'HubSpot internal property name. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Properties',
		name: 'updateJson',
		type: 'json',
		default: JSON.stringify(
			{
				hs_job_title: 'CEO',
			},
			null,
			2,
		),
		placeholder: '{\n  "hs_job_title": "CEO"\n}',
		description:
			'Properties to update as a JSON object. Keys are HubSpot internal property names.',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['update'],
				updateInputMode: ['json'],
			},
		},
	},
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-update-fields
		displayName: 'Additional Options',
		name: 'updateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['update'],
			},
		},
		options: [msOption],
	},
];
