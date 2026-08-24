import { INodeProperties } from 'n8n-workflow';

const IDENTIFIER_SHOW = {
	resource: ['marketingEvents'],
	operation: ['participationsCounts', 'participationsBreakdown'],
};
const LIST_OR_BREAKDOWN_SHOW = {
	resource: ['marketingEvents'],
	operation: ['list', 'participationsBreakdown'],
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

export const marketingEventDescription: INodeProperties[] = [
	// ── OPERATION ────────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['marketingEvents'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single marketing event',
				action: 'Get a marketing event',
			},
			{
				name: 'List',
				value: 'list',
				description: 'Retrieve marketing events',
				action: 'List marketing events',
			},
			{
				name: 'Get Participations Counts',
				value: 'participationsCounts',
				description: 'Retrieve aggregate registration/attendance counts for a marketing event',
				action: 'Get marketing event participations counts',
			},
			{
				name: 'Get Participations Breakdown',
				value: 'participationsBreakdown',
				description: 'Retrieve a per-contact participation breakdown for a marketing event',
				action: 'Get marketing event participations breakdown',
			},
		],
		default: 'list',
	},

	// ── GET ──────────────────────────────────────────────────────────────────────
	{
		displayName: 'HubSpot Event ID',
		name: 'marketingEventId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The marketing event to retrieve',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchMarketingEvents',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
			},
		],
		displayOptions: {
			show: {
				resource: ['marketingEvents'],
				operation: ['get'],
			},
		},
	},

	// ── LIST / PARTICIPATIONS BREAKDOWN — shared Return All controls ────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: LIST_OR_BREAKDOWN_SHOW,
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
				...LIST_OR_BREAKDOWN_SHOW,
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
				...LIST_OR_BREAKDOWN_SHOW,
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
				...LIST_OR_BREAKDOWN_SHOW,
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
				resource: ['marketingEvents'],
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
					"Pagination cursor returned by a previous response, used to fetch the next page. When Return All is enabled, this only seeds the first page fetched; subsequent pages follow HubSpot's own cursor.",
			},
			msOption,
		],
	},

	// ── PARTICIPATIONS COUNTS / BREAKDOWN — event identifier ────────────────────
	{
		displayName: 'Event Identifier Mode',
		name: 'eventIdentifierMode',
		type: 'options',
		noDataExpression: true,
		default: 'hubspotEventId',
		description: 'How the marketing event is identified',
		displayOptions: {
			show: IDENTIFIER_SHOW,
		},
		options: [
			{ name: 'HubSpot Event ID', value: 'hubspotEventId' },
			{ name: 'External ID', value: 'externalId' },
		],
	},
	{
		displayName: 'HubSpot Event ID',
		name: 'marketingEventId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The marketing event to look up',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchMarketingEvents',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
			},
		],
		displayOptions: {
			show: {
				...IDENTIFIER_SHOW,
				eventIdentifierMode: ['hubspotEventId'],
			},
		},
	},
	{
		displayName: 'External Account ID',
		name: 'externalAccountId',
		type: 'string',
		required: true,
		default: '',
		description:
			"The ID of the account, within the app that created the event, that the event belongs to (e.g. a Zoom account ID). HubSpot's API does not expose a way to list these, so it must be entered manually.",
		displayOptions: {
			show: {
				...IDENTIFIER_SHOW,
				eventIdentifierMode: ['externalId'],
			},
		},
	},
	{
		displayName: 'External Event ID',
		name: 'externalEventId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The ID of the event within the app that created it',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchMarketingEventExternalEventIds',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
			},
		],
		displayOptions: {
			show: {
				...IDENTIFIER_SHOW,
				eventIdentifierMode: ['externalId'],
			},
		},
	},

	// ── PARTICIPATIONS BREAKDOWN — additional options ───────────────────────────
	{
		displayName: 'Additional Options',
		name: 'breakdownOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['marketingEvents'],
				operation: ['participationsBreakdown'],
			},
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
				displayName: 'Contact Identifier',
				name: 'contactIdentifier',
				type: 'string',
				default: '',
				description:
					"Filter the breakdown down to a single contact, identified by either their HubSpot contact ID or their email address",
			},
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only return participation records created after this date and time. This endpoint returns records newest-first (by createdAt), so as soon as a record at or before this time is reached, it (and every one after it) is dropped, and Return All pagination stops.',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				default: 'REGISTERED',
				description: 'Filter the breakdown down to participants in this state',
				options: [
					{ name: 'Registered', value: 'REGISTERED' },
					{ name: 'Cancelled', value: 'CANCELLED' },
					{ name: 'Attended', value: 'ATTENDED' },
					{ name: 'No Show', value: 'NO_SHOW' },
				],
			},
			msOption,
		],
	},
];
