import type { INodeProperties } from 'n8n-workflow';

export const messageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['message'],
			},
		},
		options: [
			{
				name: 'Search Messages',
				value: 'searchMessages',
				description: 'Search for messages in a mailbox',
				action: 'Search messages',
			},
		],
		default: 'searchMessages',
	},
];

// Values match Microsoft Graph's own $select-able message properties.
const SELECTABLE_MESSAGE_PROPERTIES = [
	{ name: 'ID', value: 'id' },
	{ name: 'Created Date/Time', value: 'createdDateTime' },
	{ name: 'Last Modified Date/Time', value: 'lastModifiedDateTime' },
	{ name: 'Categories', value: 'categories' },
	{ name: 'Received Date/Time', value: 'receivedDateTime' },
	{ name: 'Sent Date/Time', value: 'sentDateTime' },
	{ name: 'Has Attachments', value: 'hasAttachments' },
	{ name: 'Subject', value: 'subject' },
	{ name: 'Body Preview', value: 'bodyPreview' },
	{ name: 'Body', value: 'body' },
	{ name: 'Importance', value: 'importance' },
	{ name: 'Parent Folder ID', value: 'parentFolderId' },
	{ name: 'Conversation ID', value: 'conversationId' },
	{ name: 'Conversation Index', value: 'conversationIndex' },
	{ name: 'Is Delivery Receipt Requested', value: 'isDeliveryReceiptRequested' },
	{ name: 'Is Read Receipt Requested', value: 'isReadReceiptRequested' },
	{ name: 'Is Read', value: 'isRead' },
	{ name: 'Is Draft', value: 'isDraft' },
	{ name: 'Web Link', value: 'webLink' },
	{ name: 'Inference Classification', value: 'inferenceClassification' },
	{ name: 'Sender', value: 'sender' },
	{ name: 'From', value: 'from' },
	{ name: 'To Recipients', value: 'toRecipients' },
	{ name: 'CC Recipients', value: 'ccRecipients' },
	{ name: 'BCC Recipients', value: 'bccRecipients' },
	{ name: 'Reply To', value: 'replyTo' },
	{ name: 'Flag', value: 'flag' },
];

// Confirmed against Microsoft's docs: only these properties are valid in $orderby
// for the messages list endpoint (https://learn.microsoft.com/en-us/graph/api/user-list-messages).
const ORDER_BY_OPTIONS = [
	{ name: 'Received Date/Time (Ascending)', value: 'receivedDateTime asc' },
	{ name: 'Received Date/Time (Descending)', value: 'receivedDateTime desc' },
	{ name: 'Subject (Ascending)', value: 'subject asc' },
	{ name: 'Subject (Descending)', value: 'subject desc' },
	{ name: 'Importance (Ascending)', value: 'importance asc' },
	{ name: 'Importance (Descending)', value: 'importance desc' },
];

export const messageFields: INodeProperties[] = [
	{
		displayName: 'Mailbox Address',
		name: 'mailboxAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'name@example.com',
		description: 'The email address of the mailbox to search',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
			},
		},
	},
	{
		displayName: 'Select',
		name: 'select',
		type: 'multiOptions',
		default: [],
		description: 'The properties to return for each message. Leave empty to return the default set (the $select query parameter is omitted entirely).',
		options: SELECTABLE_MESSAGE_PROPERTIES,
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
			},
		},
	},
	{
		displayName: 'Filter',
		name: 'filter',
		type: 'string',
		default: '',
		placeholder: "receivedDateTime ge 2024-01-01T00:00:00Z",
		description: 'A raw OData $filter expression. Leave empty to not filter.',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
			},
		},
	},
	{
		displayName: 'Max Results',
		name: 'maxResults',
		type: 'number',
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		description: 'Stop paginating once this many results have been collected. Set to 0 for no limit (pagination still stops automatically after 50,000 results as a safety valve).',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
				returnAll: [true],
			},
		},
	},
	{
		displayName: 'Return All Mode',
		name: 'returnAllMode',
		type: 'options',
		default: 'eachResult',
		options: [
			{ name: 'All Results as 1 Item', value: 'allInOne' },
			{ name: 'Each Page as 1 Item', value: 'eachPage' },
			{ name: 'Each Result as 1 Item', value: 'eachResult' },
		],
		description: 'How to structure the returned items when Return All is enabled',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
				returnAll: [true],
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['searchMessages'],
			},
		},
		options: [
			{
				displayName: 'Top',
				name: 'top',
				type: 'number',
				default: 100,
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				description: 'The $top query parameter — number of results per page (1-1000)',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description: 'The $skip query parameter — number of results to skip. Left out of the request when 0.',
			},
			{
				displayName: 'Order By',
				name: 'orderBy',
				type: 'options',
				default: '',
				options: [{ name: '- Not Set -', value: '' }, ...ORDER_BY_OPTIONS],
				description: 'The $orderby query parameter. Left out of the request when not set.',
			},
			{
				displayName: 'Mailbox Folder',
				name: 'mailboxFolder',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'All Mail', value: 'all' },
					{ name: 'Archive', value: 'archived' },
					{ name: 'Deleted Items', value: 'deleted' },
					{ name: 'Drafts', value: 'drafts' },
					{ name: 'Inbox', value: 'inbox' },
					{ name: 'Junk Email', value: 'junk' },
					{ name: 'Sent Items', value: 'sent' },
				],
				description:
					'The mail folder to search. Switch this field to an expression to search a custom well-known folder name or folder ID instead of one of the presets.',
			},
		],
	},
];
