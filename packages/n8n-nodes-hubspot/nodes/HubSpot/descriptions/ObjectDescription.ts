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

export const objectDescription: INodeProperties[] = [
	// ── Object Type ───────────────────────────────────────────────────────────
	{
		displayName: 'Object Type',
		name: 'objectType',
		type: 'options',
		typeOptions: { noValidation: true },
		displayOptions: {
			show: {
				resource: ['objects'],
			},
		},
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
		description: 'The HubSpot CRM object type to operate on',
	},

	// ── Operation ─────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['objects'],
			},
		},
		options: [
			{
				name: 'Batch Create',
				value: 'batchCreate',
				description: 'Create multiple objects in a single request',
				action: 'Batch create objects',
			},
			{
				name: 'Batch Delete',
				value: 'batchDelete',
				description: 'Archive multiple objects in a single request',
				action: 'Batch delete objects',
			},
			{
				name: 'Batch Read',
				value: 'batchRead',
				description: 'Read multiple objects by ID in a single request',
				action: 'Batch read objects',
			},
			{
				name: 'Batch Upsert',
				value: 'batchUpsert',
				description: 'Create or update multiple objects in a single request',
				action: 'Batch upsert objects',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new object',
				action: 'Create an object',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an object by ID',
				action: 'Delete an object',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single object by ID',
				action: 'Get an object',
			},
			{
				name: 'List',
				value: 'list',
				description: 'List objects of a given type',
				action: 'List objects',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search for objects using filters',
				action: 'Search objects',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing object',
				action: 'Update an object',
			},
		],
		default: 'list',
	},

	// ── Object ID (get, update, delete) ───────────────────────────────────────
	{
		displayName: 'Object ID',
		name: 'objectId',
		type: 'string',
		required: true,
		default: '',
		description:
			'The HubSpot record ID, or the value of the property specified in <em>ID Property</em>',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['get', 'update', 'delete'],
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
				resource: ['objects'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Archived',
				name: 'archived',
				type: 'boolean',
				default: false,
				description: 'Whether to include archived records in the response',
			},
			{
				displayName: 'Associations',
				name: 'associations',
				type: 'string',
				default: '',
				placeholder: '0-2,0-3',
				description: 'Comma-separated list of object types to retrieve associated records for',
			},
			{
				displayName: 'Error When Not Found',
				name: 'errorWhenNotFound',
				type: 'boolean',
				default: true,
				description:
					'Whether to throw an error when the record does not exist. When disabled, returns {"objectFound": false} instead.',
			},
			{
				displayName: 'ID Property',
				name: 'idProperty',
				type: 'string',
				default: '',
				placeholder: 'email',
				description:
					'Look up the record by this property instead of the record ID (e.g. <em>email</em> for contacts)',
			},
			msOption,
			{
				displayName: 'Properties',
				name: 'properties',
				type: 'string',
				default: '',
				placeholder: 'email,firstname,lastname',
				description:
					'Comma-separated list of property names to return. Returns all simple properties when left blank.',
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

	// ── LIST ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['objects'],
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
				resource: ['objects'],
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
				resource: ['objects'],
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
				resource: ['objects'],
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
				resource: ['objects'],
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
			{
				displayName: 'Archived',
				name: 'archived',
				type: 'boolean',
				default: false,
				description: 'Whether to only show archived records in the response',
			},
			{
				displayName: 'Associations',
				name: 'associations',
				type: 'string',
				default: '',
				placeholder: '0-2,0-3',
				description: 'Comma-separated list of object types to retrieve associated records for',
			},
			msOption,
			{
				displayName: 'Properties',
				name: 'properties',
				type: 'string',
				default: '',
				placeholder: 'email,firstname,lastname',
				description:
					'Comma-separated list of property names to return. Returns all simple properties when left blank.',
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

	// ── CREATE ────────────────────────────────────────────────────────────────
	{
		displayName: 'Input Mode',
		name: 'createInputMode',
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
				resource: ['objects'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Properties',
		name: 'createProperties',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Property',
		default: {},
		description:
			'Object properties to set. Use HubSpot internal property names (e.g. <em>email</em>, <em>firstname</em>, <em>lastname</em>).',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['create'],
				createInputMode: ['ui'],
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
						placeholder: 'email',
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
		name: 'createJson',
		type: 'json',
		default: JSON.stringify(
			{
				email: 'john@example.com',
				firstname: 'John',
				lastname: 'Doe',
			},
			null,
			2,
		),
		placeholder: '{\n  "email": "john@example.com",\n  "firstname": "John"\n}',
		description:
			'Properties to set as a JSON object. Keys are HubSpot internal property names.',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['create'],
				createInputMode: ['json'],
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'createOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['create'],
			},
		},
		options: [msOption],
	},

	// ── UPDATE ────────────────────────────────────────────────────────────────
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
				resource: ['objects'],
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
			'Object properties to update. Use HubSpot internal property names (e.g. <em>email</em>, <em>firstname</em>, <em>lastname</em>).',
		displayOptions: {
			show: {
				resource: ['objects'],
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
						placeholder: 'email',
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
				firstname: 'Jane',
				phone: '+1-555-0123',
			},
			null,
			2,
		),
		placeholder: '{\n  "firstname": "Jane",\n  "phone": "+1-555-0123"\n}',
		description:
			'Properties to update as a JSON object. Keys are HubSpot internal property names.',
		displayOptions: {
			show: {
				resource: ['objects'],
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
				resource: ['objects'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'ID Property',
				name: 'idProperty',
				type: 'string',
				default: '',
				placeholder: 'email',
				description:
					'Match the record by this property instead of the record ID (e.g. <em>email</em> for contacts)',
			},
			msOption,
		],
	},

	// ── DELETE ────────────────────────────────────────────────────────────────
	{
		displayName: 'Additional Options',
		name: 'deleteOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['delete'],
			},
		},
		options: [
			{
				displayName: 'ID Property',
				name: 'idProperty',
				type: 'string',
				default: '',
				placeholder: 'email',
				description:
					'Look up the record by this property instead of the record ID before deleting. A GET request is made first to resolve the real object ID.',
			},
			msOption,
		],
	},

	// ── SEARCH ────────────────────────────────────────────────────────────────
	{
		displayName: 'Search Body',
		name: 'searchBody',
		type: 'json',
		default: JSON.stringify(
			{
				limit: 200,
				after: 0,
				query: 'John',
				properties: ['email', 'firstname', 'lastname'],
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
				sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
			},
			null,
			2,
		),
		placeholder:
			'{\n  "filterGroups": [{"filters": [{"propertyName": "email", "operator": "EQ", "value": "..."}]}]\n}',
		description:
			'JSON body for the search request. See <a href="https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/search/search-objects">HubSpot search docs</a> for details.  Available operators: BETWEEN, CONTAINS_TOKEN, EQ, GT, GTE, HAS_PROPERTY, IN, LT, LTE, NEQ, NOT_CONTAINS_TOKEN, NOT_HAS_PROPERTY, NOT_IN.',
		displayOptions: {
			show: {
				resource: ['objects'],
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
				resource: ['objects'],
				operation: ['search'],
			},
		},
		options: [msOption],
	},

	// ── BATCH READ ────────────────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'batchReadBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [{ id: '12345' }],
				properties: ['email', 'firstname', 'lastname'],
			},
			null,
			2,
		),
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
		placeholder: '{\n  "inputs": [{"id": "12345"}],\n  "properties": ["email"]\n}',
		// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id
		description:
			'JSON body for the batch read request. Each input must have an <code>id</code> field. Optionally include <code>idProperty</code> to look up by a custom property.',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['batchRead'],
			},
		},
	},

	// ── BATCH CREATE ──────────────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'batchCreateBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [
					{
						properties: {
							email: 'john@example.com',
							firstname: 'John',
							lastname: 'Doe',
						},
					},
				],
			},
			null,
			2,
		),
		placeholder: '{\n  "inputs": [{"properties": {"email": "john@example.com"}}]\n}',
		description:
			'JSON body for the batch create request. Each input must have a <code>properties</code> object with HubSpot property names as keys.',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['batchCreate'],
			},
		},
	},

	// ── BATCH UPSERT ──────────────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'batchUpsertBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [
					{
						idProperty: 'email',
						id: 'john@example.com',
						properties: {
							firstname: 'John',
							lastname: 'Doe',
						},
					},
				],
			},
			null,
			2,
		),
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
		placeholder:
			'{\n  "inputs": [{"idProperty": "email", "id": "john@example.com", "properties": {...}}]\n}',
		// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id
		description:
			'JSON body for the batch upsert request. Each input must have <code>idProperty</code>, <code>id</code>, and <code>properties</code>. Records are created if not found, updated if found.',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['batchUpsert'],
			},
		},
	},

	// ── BATCH DELETE ──────────────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'batchDeleteBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [{ id: '12345' }],
			},
			null,
			2,
		),
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
		placeholder: '{\n  "inputs": [{"id": "12345"}]\n}',
		// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id
		description:
			'JSON body for the batch delete (archive) request. Each input must have an <code>id</code> field with the HubSpot record ID.',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['batchDelete'],
			},
		},
	},
];
