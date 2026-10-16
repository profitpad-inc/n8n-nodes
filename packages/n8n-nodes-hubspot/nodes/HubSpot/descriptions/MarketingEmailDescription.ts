import { INodePropertyOptions, INodeProperties } from 'n8n-workflow';

const EMAILS_SHOW = { resource: ['marketingEmails'] };
const EMAILS_LIST_SHOW = { ...EMAILS_SHOW, operation: ['list'] };

// Property names HubSpot's GET /marketing/emails endpoint accepts in
// includedProperties. Sort offers the same list.
const EMAIL_PROPERTY_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Active Domain', value: 'activeDomain' },
	{ name: 'Archived', value: 'archived' },
	{ name: 'Business Unit ID', value: 'businessUnitId' },
	{ name: 'Content', value: 'content' },
	{ name: 'Created At', value: 'createdAt' },
	{ name: 'Created By ID', value: 'createdById' },
	{ name: 'Email Template Mode', value: 'emailTemplateMode' },
	{ name: 'From', value: 'from' },
	{ name: 'ID', value: 'id' },
	{ name: 'Is A/B', value: 'isAb' },
	{ name: 'Is Published', value: 'isPublished' },
	{ name: 'Is Transactional', value: 'isTransactional' },
	{ name: 'Jitter Send Time', value: 'jitterSendTime' },
	{ name: 'Language', value: 'language' },
	{ name: 'Name', value: 'name' },
	{ name: 'Preview Key', value: 'previewKey' },
	{ name: 'Publish Date', value: 'publishDate' },
	{ name: 'Send On Publish', value: 'sendOnPublish' },
	{ name: 'State', value: 'state' },
	{ name: 'Subcategory', value: 'subcategory' },
	{ name: 'Subject', value: 'subject' },
	{ name: 'Subscription Details', value: 'subscriptionDetails' },
	{ name: 'To', value: 'to' },
	{ name: 'Type', value: 'type' },
	{ name: 'Updated At', value: 'updatedAt' },
	{ name: 'Updated By ID', value: 'updatedById' },
	{ name: 'Web Version', value: 'webversion' },
];

const EMAIL_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'AB_EMAIL', value: 'AB_EMAIL' },
	{ name: 'AUTOMATED_AB_EMAIL', value: 'AUTOMATED_AB_EMAIL' },
	{ name: 'AUTOMATED_EMAIL', value: 'AUTOMATED_EMAIL' },
	{ name: 'BATCH_EMAIL', value: 'BATCH_EMAIL' },
	{ name: 'BLOG_EMAIL', value: 'BLOG_EMAIL' },
	{ name: 'BLOG_EMAIL_CHILD', value: 'BLOG_EMAIL_CHILD' },
	{ name: 'FEEDBACK_CES_EMAIL', value: 'FEEDBACK_CES_EMAIL' },
	{ name: 'FEEDBACK_CUSTOM_EMAIL', value: 'FEEDBACK_CUSTOM_EMAIL' },
	{ name: 'FEEDBACK_CUSTOM_SURVEY_EMAIL', value: 'FEEDBACK_CUSTOM_SURVEY_EMAIL' },
	{ name: 'FEEDBACK_NPS_EMAIL', value: 'FEEDBACK_NPS_EMAIL' },
	{ name: 'FOLLOWUP_EMAIL', value: 'FOLLOWUP_EMAIL' },
	{ name: 'LEADFLOW_EMAIL', value: 'LEADFLOW_EMAIL' },
	{ name: 'LOCALTIME_EMAIL', value: 'LOCALTIME_EMAIL' },
	{ name: 'MANAGE_PREFERENCES_EMAIL', value: 'MANAGE_PREFERENCES_EMAIL' },
	{ name: 'MARKETING_SINGLE_SEND_API', value: 'MARKETING_SINGLE_SEND_API' },
	{ name: 'MEMBERSHIP_EMAIL_VERIFICATION_EMAIL', value: 'MEMBERSHIP_EMAIL_VERIFICATION_EMAIL' },
	{ name: 'MEMBERSHIP_FOLLOW_UP_EMAIL', value: 'MEMBERSHIP_FOLLOW_UP_EMAIL' },
	{ name: 'MEMBERSHIP_OTP_LOGIN_EMAIL', value: 'MEMBERSHIP_OTP_LOGIN_EMAIL' },
	{ name: 'MEMBERSHIP_PASSWORDLESS_AUTH_EMAIL', value: 'MEMBERSHIP_PASSWORDLESS_AUTH_EMAIL' },
	{ name: 'MEMBERSHIP_PASSWORD_RESET_EMAIL', value: 'MEMBERSHIP_PASSWORD_RESET_EMAIL' },
	{ name: 'MEMBERSHIP_PASSWORD_SAVED_EMAIL', value: 'MEMBERSHIP_PASSWORD_SAVED_EMAIL' },
	{ name: 'MEMBERSHIP_REGISTRATION_EMAIL', value: 'MEMBERSHIP_REGISTRATION_EMAIL' },
	{
		name: 'MEMBERSHIP_REGISTRATION_FOLLOW_UP_EMAIL',
		value: 'MEMBERSHIP_REGISTRATION_FOLLOW_UP_EMAIL',
	},
	{ name: 'MEMBERSHIP_VERIFICATION_EMAIL', value: 'MEMBERSHIP_VERIFICATION_EMAIL' },
	{ name: 'OPTIN_EMAIL', value: 'OPTIN_EMAIL' },
	{ name: 'OPTIN_FOLLOWUP_EMAIL', value: 'OPTIN_FOLLOWUP_EMAIL' },
	{ name: 'RESUBSCRIBE_EMAIL', value: 'RESUBSCRIBE_EMAIL' },
	{ name: 'RSS_EMAIL', value: 'RSS_EMAIL' },
	{ name: 'RSS_EMAIL_CHILD', value: 'RSS_EMAIL_CHILD' },
	{ name: 'SINGLE_SEND_API', value: 'SINGLE_SEND_API' },
	{ name: 'SMTP_TOKEN', value: 'SMTP_TOKEN' },
	{ name: 'TICKET_EMAIL', value: 'TICKET_EMAIL' },
];

export const marketingEmailDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: EMAILS_SHOW,
		},
		options: [
			{
				name: 'List',
				value: 'list',
				description: 'Retrieve marketing emails',
				action: 'List marketing emails',
			},
		],
		default: 'list',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000000000, numberPrecision: 0 },
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit
		default: 1000,
		description: 'Max number of results to return',
		displayOptions: {
			show: EMAILS_LIST_SHOW,
		},
	},
	{
		displayName: 'Additional Options',
		name: 'emailsOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: EMAILS_LIST_SHOW,
		},
		options: [
			{
				displayName: 'Archived',
				name: 'archived',
				type: 'boolean',
				default: false,
				description: 'Whether to return only archived emails',
			},
			{
				displayName: 'Campaign',
				name: 'campaign',
				type: 'string',
				default: '',
				description: 'Only return emails in the campaign with this name',
			},
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only return emails created after this date and time. A date-time with no offset is read as UTC.',
			},
			{
				displayName: 'Created Before',
				name: 'createdBefore',
				type: 'dateTime',
				default: '',
				description:
					'Only return emails created before this date and time. A date-time with no offset is read as UTC.',
			},
			{
				displayName: 'Include Email Stats',
				name: 'includeStats',
				type: 'boolean',
				default: false,
				description: 'Whether to include email statistics in the response',
			},
			{
				displayName: 'Include Marketing Campaign Names',
				name: 'marketingCampaignNames',
				type: 'boolean',
				default: false,
				description: 'Whether to include marketing campaign names in the response',
			},
			{
				displayName: 'Include Variant Stats',
				name: 'variantStats',
				type: 'boolean',
				default: false,
				description: 'Whether to include variant statistics in the response',
			},
			{
				displayName: 'Include Workflow Names',
				name: 'workflowNames',
				type: 'boolean',
				default: false,
				description: 'Whether to include workflow names in the response',
			},
			{
				displayName: 'Included Properties',
				name: 'includedProperties',
				type: 'multiOptions',
				default: [],
				description: 'Additional properties to include in the response',
				options: EMAIL_PROPERTY_OPTIONS,
			},
			{
				displayName: 'Is Published',
				name: 'isPublished',
				type: 'boolean',
				default: false,
				description:
					'Whether to return only published emails (on) or only unpublished emails (off)',
			},
			{
				displayName: 'Milliseconds Between Items',
				name: 'millisecondsBetweenItems',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 0 },
				description:
					'How long to wait between processing each input item, in milliseconds. Useful for avoiding HubSpot rate limits.',
			},
			{
				displayName: 'Published After',
				name: 'publishedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only return emails published after this date and time. A date-time with no offset is read as UTC.',
			},
			{
				displayName: 'Published Before',
				name: 'publishedBefore',
				type: 'dateTime',
				default: '',
				description:
					'Only return emails published before this date and time. A date-time with no offset is read as UTC.',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				default: 'createdAt',
				description: 'The property to sort the results by',
				options: EMAIL_PROPERTY_OPTIONS,
			},
			{
				displayName: 'States',
				name: 'states',
				type: 'multiOptions',
				default: [],
				description:
					"Only return emails in one of these states. Not sent to HubSpot: the results are filtered after they're fetched, so fewer than Limit may come back.",
				options: [
					{ name: 'Automated', value: 'AUTOMATED' },
					{ name: 'Automated Draft', value: 'AUTOMATED_DRAFT' },
					{ name: 'Draft', value: 'DRAFT' },
					{ name: 'Published', value: 'PUBLISHED' },
					{ name: 'RSS To Email Draft', value: 'RSS_TO_EMAIL_DRAFT' },
				],
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'BATCH_EMAIL',
				description: 'Only return emails of this type',
				options: EMAIL_TYPE_OPTIONS,
			},
			{
				displayName: 'Updated After',
				name: 'updatedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only return emails updated after this date and time. A date-time with no offset is read as UTC.',
			},
			{
				displayName: 'Updated Before',
				name: 'updatedBefore',
				type: 'dateTime',
				default: '',
				description:
					'Only return emails updated before this date and time. A date-time with no offset is read as UTC.',
			},
		],
	},
];
