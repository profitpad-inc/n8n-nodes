import { INodeProperties } from 'n8n-workflow';

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
			{ name: 'Communications (0-18)', value: '0-18' },
			{ name: 'Companies (0-2)', value: '0-2' },
			{ name: 'Contacts (0-1)', value: '0-1' },
			{ name: 'Contracts (0-721)', value: '0-721' },
			{ name: 'Deals (0-3)', value: '0-3' },
			{ name: 'Emails (Emails)', value: 'emails' },
			{ name: 'Invoices (0-53)', value: '0-53' },
			{ name: 'Leads (0-136)', value: '0-136' },
			{ name: 'Line Items (0-8)', value: '0-8' },
			{ name: 'Meetings (0-47)', value: '0-47' },
			{ name: 'Orders (0-123)', value: '0-123' },
			{ name: 'Payments (0-101)', value: '0-101' },
			{ name: 'Products (0-7)', value: '0-7' },
			{ name: 'Projects (0-970)', value: '0-970' },
			{ name: 'Quotes (0-14)', value: '0-14' },
			{ name: 'Tasks (Tasks)', value: 'tasks' },
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
				name: 'Create',
				value: 'create',
				description: 'Create a new object',
				action: 'Create an object',
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
				name: 'Update',
				value: 'update',
				description: 'Update an existing object',
				action: 'Update an object',
			},
		],
		default: 'list',
	},

	// ── Object ID (shared by get + update) ────────────────────────────────────
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

	// ── GET MANY ──────────────────────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['list'],
			},
		},
	},
	{
		displayName: 'Max Pages',
		name: 'maxPages',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 1,
		description: 'Maximum number of pages to fetch. Each page contains up to 100 results.',
		displayOptions: {
			show: {
				resource: ['objects'],
				operation: ['list'],
				returnAll: [true],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
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

	// ── UPDATE ────────────────────────────────────────────────────────────────
	{
		displayName: 'Update Fields',
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
		displayName: 'Update Fields',
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
		],
	},
];
