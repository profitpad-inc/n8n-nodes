import { INodeProperties } from 'n8n-workflow';

const msOption: INodeProperties = {
	displayName: 'Milliseconds Between Items',
	name: 'millisecondsBetweenItems',
	type: 'number',
	default: 50,
	typeOptions: { minValue: 0 },
	description:
		'How long to wait between processing each input item, in milliseconds. Useful for avoiding HubSpot rate limits.',
};

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

const propertiesOption: INodeProperties = {
	displayName: 'Properties',
	name: 'properties',
	type: 'string',
	default: '',
	placeholder: 'hs_job_title,hs_additional_phone',
	description:
		'Comma-separated list of property names to return. Returns all simple properties when left blank. Only applies to the Users object type.',
};

const propertiesWithHistoryOption: INodeProperties = {
	displayName: 'Properties With History',
	name: 'propertiesWithHistory',
	type: 'string',
	default: '',
	placeholder: 'hs_job_title',
	description:
		'Comma-separated list of properties to return along with their historical values. Only applies to the Users object type.',
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

	// ── GET additional options ─────────────────────────────────────────────────
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['get'],
			},
		},
		options: [
			archivedOption,
			errorWhenNotFoundOption,
			msOption,
			propertiesOption,
			propertiesWithHistoryOption,
		],
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
				operation: ['list', 'search'],
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
				operation: ['list'],
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
			propertiesOption,
			propertiesWithHistoryOption,
		],
	},

	// ── SEARCH (Users only) ─────────────────────────────────────────────────────
	{
		displayName: 'Search Body',
		name: 'searchBody',
		type: 'json',
		default: JSON.stringify(
			{
				filterGroups: [
					{
						filters: [{ propertyName: 'hs_job_title', operator: 'EQ', value: 'CEO' }],
					},
				],
				sorts: [{ propertyName: 'hs_createdate', direction: 'DESCENDING' }],
			},
			null,
			2,
		),
		placeholder:
			'{\n  "filterGroups": [{"filters": [{"propertyName": "hs_job_title", "operator": "EQ", "value": "CEO"}]}]\n}',
		description:
			'JSON body for the search request. See <a href="https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/search/search-objects">HubSpot search docs</a> for details. Available operators: BETWEEN, CONTAINS_TOKEN, EQ, GT, GTE, HAS_PROPERTY, IN, LT, LTE, NEQ, NOT_CONTAINS_TOKEN, NOT_HAS_PROPERTY, NOT_IN.',
		displayOptions: {
			show: {
				resource: ['owners'],
				operation: ['search'],
			},
		},
	},
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
			archivedOption,
			errorWhenNotFoundOption,
			msOption,
			propertiesOption,
			propertiesWithHistoryOption,
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
		typeOptions: { multipleValues: true },
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
						displayName: 'Property Name',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: 'hs_job_title',
						description: 'HubSpot internal property name',
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
