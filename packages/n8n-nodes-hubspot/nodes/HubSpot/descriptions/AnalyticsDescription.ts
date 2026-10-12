import { INodeProperties } from 'n8n-workflow';

const REPORT_SHOW = { resource: ['analytics'], operation: ['getReport'] };

// Path values for GET /analytics/v2/reports/{object_type}/{time_period}.
// HubSpot's reference page only lists the first four object types; the rest
// were supplied by the account owner and are passed through unchanged.
export const ANALYTICS_OBJECT_TYPE_OPTIONS = [
	{ name: 'Event Completions', value: 'event-completions' },
	{ name: 'Forms', value: 'forms' },
	{ name: 'Geolocation', value: 'geolocation' },
	{ name: 'Pages', value: 'pages' },
	{ name: 'Sessions', value: 'sessions' },
	{ name: 'Social Assists', value: 'social-assists' },
	{ name: 'Sources', value: 'sources' },
	{ name: 'Totals', value: 'totals' },
	{ name: 'UTM Campaigns', value: 'utm-campaigns' },
	{ name: 'UTM Contents', value: 'utm-contents' },
	{ name: 'UTM Mediums', value: 'utm-mediums' },
	{ name: 'UTM Sources', value: 'utm-sources' },
	{ name: 'UTM Terms', value: 'utm-terms' },
];

const msOption: INodeProperties = {
	displayName: 'Milliseconds Between Items',
	name: 'millisecondsBetweenItems',
	type: 'number',
	default: 50,
	typeOptions: { minValue: 0 },
	description:
		'How long to wait between processing each input item, in milliseconds. Useful for avoiding HubSpot rate limits.',
};

export const analyticsDescription: INodeProperties[] = [
	// ── Operation ───────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['analytics'],
			},
		},
		options: [
			{
				name: 'Get Report',
				value: 'getReport',
				description: 'Retrieve analytics data for an object type over a time period',
				action: 'Get an analytics report',
			},
		],
		default: 'getReport',
	},

	// ── GET REPORT ──────────────────────────────────────────────────────────────
	{
		displayName: 'Object Type',
		name: 'analyticsObjectType',
		type: 'options',
		required: true,
		options: ANALYTICS_OBJECT_TYPE_OPTIONS,
		default: 'pages',
		description: 'The type of object to get analytics data for',
		displayOptions: {
			show: REPORT_SHOW,
		},
	},
	{
		displayName: 'Time Period',
		name: 'timePeriod',
		type: 'options',
		required: true,
		options: [
			{ name: 'Daily', value: 'daily' },
			{ name: 'Monthly', value: 'monthly' },
			{ name: 'Summarize Daily', value: 'summarize/daily' },
			{ name: 'Summarize Monthly', value: 'summarize/monthly' },
			{ name: 'Summarize Weekly', value: 'summarize/weekly' },
			{ name: 'Total', value: 'total' },
			{ name: 'Weekly', value: 'weekly' },
		],
		default: 'total',
		description: 'How the data is grouped over time',
		displayOptions: {
			show: REPORT_SHOW,
		},
	},
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'First day of the report. Only the date is used; any time is ignored.',
		displayOptions: {
			show: REPORT_SHOW,
		},
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'Last day of the report. Only the date is used; any time is ignored.',
		displayOptions: {
			show: REPORT_SHOW,
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: REPORT_SHOW,
		},
	},
	{
		displayName: 'Return All Mode',
		name: 'returnAllMode',
		type: 'options',
		noDataExpression: true,
		default: 'allInOne',
		description: 'How to output the fetched results',
		displayOptions: {
			show: { ...REPORT_SHOW, returnAll: [true] },
		},
		options: [
			{
				name: 'All Results as 1 Item',
				value: 'allInOne',
				description:
					'Combine every page into one item with <code>total</code>, <code>totals</code> and all <code>breakdowns</code>',
			},
			{
				name: 'Each Page as 1 Item',
				value: 'eachPage',
				description: 'Return each API page response as a separate output item',
			},
			{
				name: 'Each Result as 1 Item',
				value: 'eachResult',
				description: 'Return each breakdown as a separate output item',
			},
		],
	},
	{
		displayName: 'Max Pages',
		name: 'maxPages',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 10,
		description: 'Maximum number of pages to fetch. Each page contains up to 350 results.',
		displayOptions: {
			show: { ...REPORT_SHOW, returnAll: [true] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 350 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { ...REPORT_SHOW, returnAll: [false] },
		},
	},
	{
		displayName: 'Additional Options',
		name: 'reportOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: REPORT_SHOW,
		},
		options: [
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Exclude Breakdowns',
				name: 'excludeBreakdowns',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getAnalyticsBreakdowns',
					loadOptionsDependsOn: [
						'analyticsObjectType',
						'startDate',
						'endDate',
						'reportOptions.filterId',
					],
				},
				default: [],
				description:
					'Breakdowns to leave out of the results (HubSpot <code>e</code> parameter). The list comes from the selected Object Type, dates and Filter (Analytics View). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
				displayName: 'Filter (Analytics View)',
				name: 'filterId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAnalyticsViews',
				},
				default: '',
				description:
					'Only include data matching this analytics view. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Include Breakdowns',
				name: 'includeBreakdowns',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getAnalyticsBreakdowns',
					loadOptionsDependsOn: [
						'analyticsObjectType',
						'startDate',
						'endDate',
						'reportOptions.filterId',
					],
				},
				default: [],
				description:
					'Only return these breakdowns (HubSpot <code>f</code> parameter). The list comes from the selected Object Type, dates and Filter (Analytics View). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			msOption,
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				typeOptions: { minValue: 0, numberPrecision: 0 },
				default: 0,
				description:
					'Where to start in the result set. With Return All on, this seeds the first page.',
			},
		],
	},
];
