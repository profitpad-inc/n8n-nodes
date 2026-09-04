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
				name: 'Get Message',
				value: 'getMessage',
				description: 'Get a single message by ID',
				action: 'Get a message',
			},
			{
				name: 'Search Messages',
				value: 'searchMessages',
				description: 'Search for messages in a mailbox',
				action: 'Search messages',
			},
			{
				name: 'Send Mail',
				value: 'sendMail',
				description: 'Send a new email',
				action: 'Send an email',
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

/**
 * Builds the "Fields" + "JSON" pair of properties for one recipient list
 * (To / CC / BCC), all scoped to Message → Send Mail. Which of the two shows
 * is driven by the single shared `recipientsMode` field (see `messageFields`
 * below), not a per-recipient-type mode — To/CC/BCC switch input style
 * together. `prefix` becomes the parameter name prefix (`${prefix}Recipients`,
 * `${prefix}Json`). `jsonDefault` is `'[]'` for CC/BCC (empty is the common
 * case) but an example array for To, since To is required and an empty
 * array is never actually valid there.
 */
function buildRecipientFields(
	prefix: 'to' | 'cc' | 'bcc',
	label: string,
	required: boolean,
	jsonDefault: string,
): INodeProperties[] {
	return [
		{
			displayName: label,
			name: `${prefix}Recipients`,
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			placeholder: `Add ${label} Recipient`,
			default: {},
			required,
			description: required ? 'At least one recipient is required' : undefined,
			displayOptions: {
				show: {
					resource: ['message'],
					operation: ['sendMail'],
					recipientsMode: ['fields'],
				},
			},
			options: [
				{
					displayName: 'Recipient',
					name: 'recipient',
					values: [
						{
							displayName: 'Email',
							name: 'email',
							type: 'string',
							required: true,
							default: '',
							placeholder: 'name@example.com',
						},
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
						},
					],
				},
			],
		},
		{
			displayName: `${label} (JSON)`,
			name: `${prefix}Json`,
			type: 'json',
			default: jsonDefault,
			placeholder: '[{"name": "Jane Doe", "email": "jane@example.com"}]',
			description: 'An array of objects, each with "email" (required) and "name" (optional)',
			displayOptions: {
				show: {
					resource: ['message'],
					operation: ['sendMail'],
					recipientsMode: ['json'],
				},
			},
		},
	];
}

export const messageFields: INodeProperties[] = [
	{
		displayName: 'Mailbox Address',
		name: 'mailboxAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'name@example.com',
		description: 'The email address of the mailbox',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['getMessage', 'searchMessages', 'sendMail'],
			},
		},
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID of the message to retrieve',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['getMessage'],
			},
		},
	},
	{
		displayName: 'Include Attachments',
		name: 'includeAttachments',
		type: 'options',
		default: 'none',
		options: [
			{ name: 'Do Not Include', value: 'none' },
			{ name: 'Include As File', value: 'file' },
			{ name: 'Include In Both', value: 'both' },
			{ name: 'Include In JSON', value: 'json' },
		],
		description:
			'Whether to fetch the message\'s attachments, and how to attach them to the output: as binary files, as an "attachments" array in the JSON (with base64 file content), or both',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['getMessage'],
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
				operation: ['getMessage', 'searchMessages'],
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
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
			},
		},
	},
	{
		displayName: 'HTML Body',
		name: 'htmlBody',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		default: '',
		description: 'The email body, sent as HTML content',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
			},
		},
	},
	{
		displayName: 'Recipients Input Mode',
		name: 'recipientsMode',
		type: 'options',
		default: 'fields',
		options: [
			{ name: 'Fields', value: 'fields' },
			{ name: 'JSON', value: 'json' },
		],
		description: 'Applies to To, CC, and BCC below',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
			},
		},
	},
	...buildRecipientFields(
		'to',
		'To',
		true,
		`[
  {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
]`,
	),
	...buildRecipientFields('cc', 'CC', false, '[]'),
	...buildRecipientFields('bcc', 'BCC', false, '[]'),
	{
		displayName: 'Attachments Input Mode',
		name: 'attachmentsMode',
		type: 'options',
		default: 'none',
		options: [
			{ name: 'Base64', value: 'base64' },
			{ name: 'JSON', value: 'json' },
			{ name: 'N8n Files', value: 'binary' },
			{ name: 'None', value: 'none' },
			{ name: 'URLs', value: 'url' },
		],
		description:
			"How to source any file(s) to attach to the email. Base64 / URLs use a fixed number of rows added manually in the UI; use JSON or N8n Files (left blank) when the number of attachments varies per execution and isn't known ahead of time.",
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
			},
		},
	},
	{
		displayName: 'Attachments (Base64)',
		name: 'attachmentsBase64',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Attachment',
		default: {},
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
				attachmentsMode: ['base64'],
			},
		},
		options: [
			{
				displayName: 'Attachment',
				name: 'attachment',
				values: [
					{
						displayName: 'File Name',
						name: 'name',
						type: 'string',
						required: true,
						default: '',
						placeholder: 'document.pdf',
					},
					{
						displayName: 'Content Type',
						name: 'contentType',
						type: 'string',
						default: '',
						placeholder: 'application/pdf',
						description: 'Leave empty to let Graph infer it from the file name',
					},
					{
						displayName: 'Content (Base64)',
						name: 'content',
						type: 'string',
						typeOptions: {
							rows: 3,
						},
						required: true,
						default: '',
						description: 'The base64-encoded file content',
					},
				],
			},
		],
	},
	{
		displayName: 'Attachments (JSON)',
		name: 'attachmentsJson',
		type: 'json',
		default: `[
  {
    "name": "document.pdf",
    "contentType": "application/pdf",
    "contentBytes": "JVBERi0xLjQK..."
  },
  {
    "url": "https://example.com/invoice.pdf"
  }
]`,
		placeholder:
			'[{"name": "document.pdf", "contentType": "application/pdf", "contentBytes": "..."}, {"url": "https://example.com/invoice.pdf"}]',
		description: 'An array of objects, each with "contentType" (optional) and either "contentBytes" (base64-encoded; "name" is then required) or "URL" (fetched and attached; "name" defaults to the URL\'s own file name when omitted)',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
				attachmentsMode: ['json'],
			},
		},
	},
	{
		displayName: 'Input Binary Fields',
		name: 'attachmentsBinaryProperties',
		type: 'string',
		default: '',
		placeholder: 'data,attachment_0',
		description:
			'Comma-separated list of binary property names on the input item to attach. Leave empty to attach every binary property present on the item — use this when the number of attachments varies per execution.',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
				attachmentsMode: ['binary'],
			},
		},
	},
	{
		displayName: 'Attachments (URLs)',
		name: 'attachmentsUrls',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Attachment',
		default: {},
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
				attachmentsMode: ['url'],
			},
		},
		options: [
			{
				displayName: 'Attachment',
				name: 'attachment',
				values: [
					{
						displayName: 'URL',
						name: 'url',
						type: 'string',
						required: true,
						default: '',
						placeholder: 'https://example.com/document.pdf',
						description: 'A publicly reachable URL; its content is downloaded and attached',
					},
					{
						displayName: 'File Name',
						name: 'name',
						type: 'string',
						default: '',
						description: "Leave empty to use the URL's own file name",
					},
					{
						displayName: 'Content Type',
						name: 'contentType',
						type: 'string',
						default: '',
						placeholder: 'application/pdf',
						description: "Leave empty to use the response's Content-Type header",
					},
				],
			},
		],
	},
	{
		displayName: 'Additional Options',
		name: 'sendMailAdditionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendMail'],
			},
		},
		options: [
			{
				displayName: 'Save To Sent Items',
				name: 'saveToSentItems',
				type: 'boolean',
				default: true,
				description: 'Whether to save the sent message in the Sent Items folder',
			},
		],
	},
];
