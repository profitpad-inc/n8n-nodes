import { INodeProperties } from 'n8n-workflow';

const FORM_SUBMISSIONS_SHOW = { resource: ['forms'], operation: ['getFormSubmissions'] };

const msOption: INodeProperties = {
	displayName: 'Milliseconds Between Items',
	name: 'millisecondsBetweenItems',
	type: 'number',
	default: 50,
	typeOptions: { minValue: 0 },
	description:
		'How long to wait between processing each input item, in milliseconds. Useful for avoiding HubSpot rate limits.',
};

export const formDescription: INodeProperties[] = [
	// ── Operation ───────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['forms'],
			},
		},
		options: [
			{
				name: 'Get All Forms',
				value: 'getAllForms',
				description: 'Retrieve every form in the account',
				action: 'Get all forms',
			},
			{
				name: 'Get Form Submissions',
				value: 'getFormSubmissions',
				description: 'Retrieve submissions for a specific form',
				action: 'Get form submissions',
			},
		],
		default: 'getAllForms',
	},

	// ── GET FORM SUBMISSIONS ──────────────────────────────────────────────────────
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Form',
		name: 'formGuid',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getForms',
		},
		default: '',
		description:
			'The form to retrieve submissions for. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: FORM_SUBMISSIONS_SHOW,
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: FORM_SUBMISSIONS_SHOW,
		},
	},
	{
		displayName: 'Return All Mode',
		name: 'returnAllMode',
		type: 'options',
		noDataExpression: true,
		default: 'eachResult',
		description: 'How to output the fetched submissions',
		displayOptions: {
			show: {
				...FORM_SUBMISSIONS_SHOW,
				returnAll: [true],
			},
		},
		options: [
			{
				name: 'All Results as 1 Item',
				value: 'allInOne',
				description: 'Aggregate all pages and return every submission combined in a single output item',
			},
			{
				name: 'Each Page as 1 Item',
				value: 'eachPage',
				description: 'Return each API page response as a separate output item',
			},
			{
				name: 'Each Result as 1 Item',
				value: 'eachResult',
				description: 'Return each individual submission as a separate output item',
			},
		],
	},
	{
		displayName: 'Max Pages',
		name: 'maxPages',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 20,
		description:
			'Maximum number of submission pages to fetch. Each page contains up to 50 submissions (HubSpot\'s cap for this endpoint).',
		displayOptions: {
			show: {
				...FORM_SUBMISSIONS_SHOW,
				returnAll: [true],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit
		default: 20,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				...FORM_SUBMISSIONS_SHOW,
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'submissionsOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: FORM_SUBMISSIONS_SHOW,
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
				displayName: 'Submitted After',
				name: 'submittedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only return submissions submitted after this date and time. HubSpot returns submissions newest-first, so as soon as a submission at or before this time is reached, it (and every one after it) is dropped, and Return All pagination stops.',
			},
			msOption,
		],
	},
];
