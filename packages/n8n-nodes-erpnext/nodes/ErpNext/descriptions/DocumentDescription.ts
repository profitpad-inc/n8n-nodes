import { INodeProperties } from 'n8n-workflow';

const showForDocument = { resource: ['document'] };

const fieldValuesCollection = (name: string, operations: string[]): INodeProperties => ({
	displayName: 'Fields',
	name,
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Field',
	default: {},
	displayOptions: { show: { ...showForDocument, operation: operations, inputMode: ['ui'] } },
	options: [
		{
			displayName: 'Field',
			name: 'fieldValues',
			values: [
				{
					// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
					displayName: 'Field Name',
					name: 'name',
					type: 'options',
					typeOptions: { loadOptionsMethod: 'getDocTypeFields', loadOptionsDependsOn: ['docType'] },
					default: '',
					// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
					description:
						'The fieldname to set. Choose from the list, or specify a fieldname using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
});

export const documentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForDocument },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a document',
				action: 'Create a document',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a document',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a document',
				action: 'Delete a document',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve one document with its child tables',
				action: 'Get a document',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List documents that match filters',
				action: 'Get many documents',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a document by name',
				action: 'Update a document',
			},
		],
		default: 'get',
	},

	// ── DocType ──────────────────────────────────────────────────────────────
	{
		displayName: 'DocType Name or ID',
		name: 'docType',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getDocTypes' },
		required: true,
		default: '',
		displayOptions: { show: showForDocument },
		description:
			'The ERPNext DocType, e.g. Customer or Contact. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},

	// ── Document name (get / update / delete) ────────────────────────────────
	{
		displayName: 'Document Name',
		name: 'documentName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...showForDocument, operation: ['get', 'update', 'delete'] } },
		description:
			"The document's name (its ID in ERPNext), e.g. CUST-0001 or Palmer Productions Ltd",
	},

	// ── Upsert matching ──────────────────────────────────────────────────────
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Match On Field',
		name: 'matchField',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getDocTypeFields', loadOptionsDependsOn: ['docType'] },
		required: true,
		default: 'name',
		displayOptions: { show: { ...showForDocument, operation: ['upsert'] } },
		// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
		description:
			'Field used to find the existing document, e.g. a stored external ID. Choose from the list, or specify a fieldname using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Match Value',
		name: 'matchValue',
		type: 'string',
		default: '',
		displayOptions: { show: { ...showForDocument, operation: ['upsert'] } },
		description:
			'Value of the match field to look for. Leave empty to go straight to the fallback match.',
	},

	// ── Field input (create / update / upsert) ───────────────────────────────
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		options: [
			{ name: 'Fields', value: 'ui', description: 'Set fields one by one' },
			{
				name: 'JSON',
				value: 'json',
				description: 'Send a JSON object, including child tables as arrays of rows',
			},
		],
		default: 'ui',
		displayOptions: { show: { ...showForDocument, operation: ['create', 'update', 'upsert'] } },
	},
	fieldValuesCollection('fieldsUi', ['create', 'update', 'upsert']),
	{
		displayName: 'Fields (JSON)',
		name: 'fieldsJson',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: { ...showForDocument, operation: ['create', 'update', 'upsert'], inputMode: ['json'] },
		},
		description:
			'Document fields as JSON. Child tables are arrays of row objects, e.g. {"email_ids": [{"email_id": "a@b.com", "is_primary": 1}]}.',
	},

	// ── Get Many ─────────────────────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { ...showForDocument, operation: ['getMany'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { ...showForDocument, operation: ['getMany'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters (JSON)',
		name: 'filters',
		type: 'json',
		default: '[]',
		displayOptions: { show: { ...showForDocument, operation: ['getMany'] } },
		description:
			'Frappe filters, e.g. [["customer_type", "=", "Company"], ["modified", ">", "2026-01-01"]]',
	},
	{
		displayName: 'Fields to Return',
		name: 'returnFields',
		type: 'string',
		default: 'name',
		displayOptions: { show: { ...showForDocument, operation: ['getMany'] } },
		description: 'Comma-separated fieldnames, or * for every top-level field',
	},

	// ── Options ──────────────────────────────────────────────────────────────
	{
		displayName: 'Options',
		name: 'getOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { ...showForDocument, operation: ['get'] } },
		options: [
			{
				displayName: 'Error When Not Found',
				name: 'errorWhenNotFound',
				type: 'boolean',
				default: true,
				description:
					'Whether a missing document fails the item. When off, the item returns {"found": false} instead.',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'getManyOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { ...showForDocument, operation: ['getMany'] } },
		options: [
			{
				displayName: 'Or Filters (JSON)',
				name: 'orFilters',
				type: 'json',
				default: '[]',
				description: 'Frappe filters where any one match is enough, same shape as Filters',
			},
			{
				displayName: 'Order By',
				name: 'orderBy',
				type: 'string',
				default: 'modified desc',
				description: 'Sort order, e.g. modified desc or customer_name asc',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'writeOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { ...showForDocument, operation: ['update', 'upsert'] } },
		options: [
			{
				displayName: 'Create If Not Found',
				name: 'createIfNotFound',
				type: 'boolean',
				default: true,
				displayOptions: { show: { '/operation': ['upsert'] } },
				description:
					'Whether to create the document when nothing matches. When off, the item returns action "notFound".',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
				displayName: 'Fallback Match Field',
				name: 'fallbackMatchField',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getDocTypeFields',
					loadOptionsDependsOn: ['docType'],
				},
				default: '',
				displayOptions: { show: { '/operation': ['upsert'] } },
				// eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-options
				description:
					'Second field to try when the first match finds nothing, e.g. customer_name or email_id. Choose from the list, or specify a fieldname using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Fallback Match Value',
				name: 'fallbackMatchValue',
				type: 'string',
				default: '',
				displayOptions: { show: { '/operation': ['upsert'] } },
			},
			{
				displayName: 'Skip If Unchanged',
				name: 'skipIfUnchanged',
				type: 'boolean',
				default: true,
				description:
					'Whether to skip the write when every field sent already has that value. A skipped write returns changed: false and fires nothing in ERPNext, which is what stops two-way syncs from looping.',
			},
		],
	},
];
