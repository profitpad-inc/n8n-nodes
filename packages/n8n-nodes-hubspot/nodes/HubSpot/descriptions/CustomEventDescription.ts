import { INodeProperties } from 'n8n-workflow';

const RESOURCE_SHOW = { resource: ['customEvents'] };
const SEND_SHOW = { resource: ['customEvents'], operation: ['sendEventOccurrence'] };
const SEARCH_EVENTS_SHOW = { resource: ['customEvents'], operation: ['getEvents'] };
const LIST_SHOW = {
	resource: ['customEvents'],
	operation: ['getEvents', 'getEventDefinitions'],
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

export const customEventDescription: INodeProperties[] = [
	// ── OPERATION ────────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: RESOURCE_SHOW,
		},
		options: [
			{
				name: 'List Event Definitions',
				value: 'getEventDefinitions',
				description: 'Retrieve the custom event type definitions in the account',
				action: 'List event definitions',
			},
			{
				name: 'Search Event Occurrences',
				value: 'getEvents',
				description: 'Search custom event occurrences',
				action: 'Search event occurrences',
			},
			{
				name: 'Send Event Occurrence',
				value: 'sendEventOccurrence',
				description: 'Send a single custom event occurrence',
				action: 'Send an event occurrence',
			},
			{
				name: 'Batch Send Event Occurrences',
				value: 'batchSendEventOccurrences',
				description: 'Send a batch of custom event occurrences',
				action: 'Batch send event occurrences',
			},
		],
		default: 'getEvents',
	},

	// ── SEARCH EVENT OCCURRENCES ─────────────────────────────────────────────────
	{
		displayName: 'Event Type Name or ID',
		name: 'eventType',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getCustomEventTypes',
		},
		default: '',
		description:
			'Only return occurrences of this event type. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: SEARCH_EVENTS_SHOW,
		},
	},

	// ── SEARCH EVENT OCCURRENCES / LIST EVENT DEFINITIONS — shared Return All controls
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: LIST_SHOW,
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
				...LIST_SHOW,
				returnAll: [true],
			},
		},
		options: [
			{
				name: 'All Results as 1 Item',
				value: 'allInOne',
				description:
					'Aggregate all pages and return every result combined in a single output item',
			},
			{
				name: 'Each Page as 1 Item',
				value: 'eachPage',
				description: 'Return each API page response as a separate output item',
			},
			{
				name: 'Each Result as 1 Item',
				value: 'eachResult',
				description: 'Return each individual result as a separate output item',
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
				...LIST_SHOW,
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
				...LIST_SHOW,
				returnAll: [false],
			},
		},
	},

	// ── LIST EVENT DEFINITIONS — additional options ─────────────────────────────
	{
		displayName: 'Additional Options',
		name: 'eventDefinitionsOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['customEvents'], operation: ['getEventDefinitions'] },
		},
		options: [
			{
				displayName: 'After (Cursor)',
				name: 'after',
				type: 'string',
				default: '',
				description:
					"Pagination cursor returned by a previous response, used to fetch the next page. When Return All is enabled, this only seeds the first page fetched; subsequent pages follow HubSpot's own cursor.",
			},
			{
				displayName: 'Include Properties',
				name: 'includeProperties',
				type: 'boolean',
				default: false,
				description: 'Whether to include each event type\'s custom property definitions in the response',
			},
			msOption,
			{
				displayName: 'Search String',
				name: 'searchString',
				type: 'string',
				default: '',
				description: 'Only return event definitions matching this search term',
			},
			{
				displayName: 'Sort Order',
				name: 'sortOrder',
				type: 'string',
				default: '',
				description: 'Passed through as-is to HubSpot\'s sortOrder query parameter',
			},
		],
	},

	// ── SEARCH EVENT OCCURRENCES — additional options ───────────────────────────
	{
		displayName: 'Additional Options',
		name: 'getEventsOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: SEARCH_EVENTS_SHOW,
		},
		options: [
			{
				displayName: 'After (Cursor)',
				name: 'after',
				type: 'string',
				default: '',
				description:
					"Pagination cursor returned by a previous response, used to fetch the next page. When Return All is enabled, this only seeds the first page fetched; subsequent pages follow HubSpot's own cursor.",
			},
			{
				displayName: 'Before (Cursor)',
				name: 'before',
				type: 'string',
				default: '',
				description: 'Pagination cursor for fetching the previous page',
			},
			{
				displayName: 'Event IDs',
				name: 'ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of specific event occurrence IDs to return',
			},
			{
				displayName: 'Event Property Filters',
				name: 'eventPropertyFilters',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Filter',
				default: {},
				description: "Filter by a property of the event itself (HubSpot's property.* query parameter)",
				options: [
					{
						name: 'filterValues',
						displayName: 'Filter',
						values: [
							{
								displayName: 'Property Name',
								name: 'name',
								type: 'string',
								default: '',
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
			msOption,
			{
				displayName: 'Object ID',
				name: 'objectId',
				type: 'string',
				default: '',
				description: 'Only return occurrences on this specific record',
			},
			{
				displayName: 'Object Property Filters',
				name: 'objectPropertyFilters',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Filter',
				default: {},
				description: "Filter by a value of the record the event occurred on (HubSpot's objectProperty.* query parameter)",
				options: [
					{
						name: 'filterValues',
						displayName: 'Filter',
						values: [
							{
								displayName: 'Property Name',
								name: 'name',
								type: 'string',
								default: '',
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
				displayName: 'Object Type',
				name: 'objectType',
				type: 'string',
				default: '',
				description:
					'Only return occurrences on records of this HubSpot object type (e.g. 0-1 for contacts)',
			},
			{
				displayName: 'Occurred After',
				name: 'occurredAfter',
				type: 'dateTime',
				default: '',
				description: 'Only return events that occurred after this date and time',
			},
			{
				displayName: 'Occurred Before',
				name: 'occurredBefore',
				type: 'dateTime',
				default: '',
				description: 'Only return events that occurred before this date and time',
			},
			{
				displayName: 'Properties',
				name: 'properties',
				type: 'string',
				default: '',
				description: 'Comma-separated list of event properties to include in the response',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of fields to sort by. Prefix a field with "-" to sort descending (e.g. -occurredAt).',
			},
		],
	},

	// ── SEND EVENT OCCURRENCE ────────────────────────────────────────────────────
	{
		displayName: 'Event Name or ID',
		name: 'eventName',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getSendableCustomEventTypes',
			noValidation: true,
		},
		required: true,
		default: '',
		description:
			'The event\'s fully qualified name (formatted as pe{HubID}_{name}). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: SEND_SHOW,
		},
	},
	{
		displayName: 'Identify Record By',
		name: 'identifyBy',
		type: 'options',
		noDataExpression: true,
		default: 'objectId',
		description: 'How to associate this event occurrence with a CRM record',
		displayOptions: {
			show: SEND_SHOW,
		},
		options: [
			{
				name: 'Object ID',
				value: 'objectId',
				description: 'Identify the record by its HubSpot object ID',
			},
			{
				name: 'Custom Matching Property',
				value: 'custom',
				description:
					'Match an existing record using one of the properties below (e.g. a custom unique identifier)',
			},
			{
				name: 'Email (Contacts Only)',
				value: 'email',
				description: "Identify a contact by the visitor's email address",
			},
		],
	},
	{
		displayName: 'Object ID',
		name: 'objectId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the record the event occurred on (e.g. a contact or visitor ID)',
		displayOptions: {
			show: {
				...SEND_SHOW,
				identifyBy: ['objectId'],
			},
		},
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description: "The contact's email address",
		displayOptions: {
			show: {
				...SEND_SHOW,
				identifyBy: ['email'],
			},
		},
	},
	{
		displayName: 'Properties Input Mode',
		name: 'eventPropertiesInputMode',
		type: 'options',
		noDataExpression: true,
		default: 'ui',
		options: [
			{
				name: 'Fields',
				value: 'ui',
				description: 'Fill in individual fields',
			},
			{
				name: 'Custom JSON',
				value: 'json',
				description: 'Provide a raw JSON object',
			},
		],
		displayOptions: {
			show: SEND_SHOW,
		},
	},
	{
		displayName: 'Properties',
		name: 'eventProperties',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
			fixedCollection: { itemTitle: '={{$collection.item.value.name}}' },
		},
		placeholder: 'Add Property',
		default: {},
		description:
			'Event properties to send, plus (in Custom Matching Property mode) the property used to match an existing record',
		displayOptions: {
			show: {
				...SEND_SHOW,
				eventPropertiesInputMode: ['ui'],
			},
		},
		options: [
			{
				name: 'propertyValues',
				displayName: 'Property',
				values: [
					{
						displayName: 'Property Name or ID',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getCustomEventProperties',
							loadOptionsDependsOn: ['eventName'],
							noValidation: true,
						},
						default: '',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
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
		name: 'eventPropertiesJson',
		type: 'json',
		default: JSON.stringify(
			{
				hs_city: 'Cambridge',
				hs_country: 'United States',
				hs_page_id: '53005768010',
			},
			null,
			2,
		),
		description:
			'Event properties to send as a JSON object. In Custom Matching Property mode, include the matching property here too (e.g. example_custom_matching_property).',
		displayOptions: {
			show: {
				...SEND_SHOW,
				eventPropertiesInputMode: ['json'],
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'sendEventOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: SEND_SHOW,
		},
		options: [
			{
				displayName: 'UUID',
				name: 'uuid',
				type: 'string',
				default: '',
				description:
					'A unique identifier for this event occurrence, unique within the event type. HubSpot generates one automatically if left blank.',
			},
			{
				displayName: 'UTK',
				name: 'utk',
				type: 'string',
				default: '',
				description:
					"The visitor's HubSpot user token, used to associate this event with a visitor's tracked activity",
			},
			{
				displayName: 'Occurred At',
				name: 'occurredAt',
				type: 'string',
				default: '={{ $now }}',
				description:
					'When the event occurred, as an ISO 8601 date-time. Defaults to the current time.',
			},
			msOption,
		],
	},

	// ── BATCH SEND EVENT OCCURRENCES ─────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'batchSendEventOccurrencesBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [
					{
						eventName: 'pe1234567_login_event',
						objectId: '608051',
						properties: {
							hs_city: 'Cambridge',
							hs_country: 'United States',
							hs_page_id: '53005768010',
						},
					},
				],
			},
			null,
			2,
		),
		description: 'The raw request body sent to HubSpot',
		displayOptions: {
			show: {
				resource: ['customEvents'],
				operation: ['batchSendEventOccurrences'],
			},
		},
	},
];
