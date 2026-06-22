import { INodeProperties } from 'n8n-workflow';

const OBJECT_TYPE_OPTIONS = [
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
];

export const associationDescription: INodeProperties[] = [
	// ── Operation ─────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['associations'],
			},
		},
		options: [
			{
				name: 'Batch Create Default',
				value: 'assocBatchCreateDefault',
				description: 'Create default associations between objects in bulk',
				action: 'Batch create default associations',
			},
			{
				name: 'Batch Create Labeled',
				value: 'assocBatchCreateLabeled',
				description: 'Create labeled associations between objects in bulk',
				action: 'Batch create labeled associations',
			},
			{
				name: 'Batch Delete',
				value: 'assocBatchDelete',
				description: 'Delete associations between objects in bulk',
				action: 'Batch delete associations',
			},
			{
				name: 'Batch Read',
				value: 'assocBatchRead',
				description: 'Read associations between objects in bulk',
				action: 'Batch read associations',
			},
			{
				name: 'Read Labels',
				value: 'assocReadLabels',
				description: 'Retrieve all association labels between two object types',
				action: 'Read association labels',
			},
		],
		default: 'assocBatchRead',
	},

	// ── From Object Type ───────────────────────────────────────────────────────
	{
		displayName: 'From Object Type',
		name: 'fromObjectType',
		type: 'options',
		typeOptions: { noValidation: true },
		displayOptions: {
			show: {
				resource: ['associations'],
			},
		},
		options: OBJECT_TYPE_OPTIONS,
		default: '0-1',
		description: 'The HubSpot CRM object type the associations originate from',
	},

	// ── To Object Type ─────────────────────────────────────────────────────────
	{
		displayName: 'To Object Type',
		name: 'toObjectType',
		type: 'options',
		typeOptions: { noValidation: true },
		displayOptions: {
			show: {
				resource: ['associations'],
			},
		},
		options: OBJECT_TYPE_OPTIONS,
		default: '0-3',
		description: 'The HubSpot CRM object type the associations point to',
	},

	// ── BATCH READ ─────────────────────────────────────────────────────────────
	{
		displayName: 'From IDs',
		name: 'fromIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '12345,67890,11111',
		description:
			'Comma-separated list of IDs (or property values when <em>From ID Property</em> is set). Requests are sent in batches of 1000.',
		displayOptions: {
			show: {
				resource: ['associations'],
				operation: ['assocBatchRead'],
			},
		},
	},
	{
		displayName: 'From ID Property',
		name: 'fromIdProperty',
		type: 'string',
		default: '',
		placeholder: 'email',
		description:
			'Look up "From" records by this property instead of the record ID (e.g. <em>email</em> for contacts). When set, a batch object read is performed first — in batches of 100 — to resolve the real HubSpot IDs before reading associations.',
		displayOptions: {
			show: {
				resource: ['associations'],
				operation: ['assocBatchRead'],
			},
		},
	},

	// ── BATCH DELETE ───────────────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'assocBatchDeleteBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [
					{
						from: { id: '12345' },
						to: [{ id: '67890' }],
					},
				],
			},
			null,
			2,
		),
		description:
			'JSON body for the batch delete request. Maximum of 1000 inputs. See <a href="https://developers.hubspot.com/docs/api-reference/latest/crm/associations/associate-records/batch/delete-associations">HubSpot docs</a> for the full schema.',
		displayOptions: {
			show: {
				resource: ['associations'],
				operation: ['assocBatchDelete'],
			},
		},
	},

	// ── BATCH CREATE DEFAULT ───────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'assocBatchCreateDefaultBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [
					{
						from: { id: '12345' },
						to: { id: '67890' },
					},
				],
			},
			null,
			2,
		),
		description:
			'JSON body for the batch create default associations request. Maximum of 2000 inputs. See <a href="https://developers.hubspot.com/docs/api-reference/latest/crm/associations/associate-records/batch/create-associations">HubSpot docs</a> for the full schema.',
		displayOptions: {
			show: {
				resource: ['associations'],
				operation: ['assocBatchCreateDefault'],
			},
		},
	},

	// ── BATCH CREATE LABELED ───────────────────────────────────────────────────
	{
		displayName: 'Body',
		name: 'assocBatchCreateLabeledBody',
		type: 'json',
		default: JSON.stringify(
			{
				inputs: [
					{
						from: { id: '12345' },
						to: { id: '67890' },
						types: [{ associationCategory: 'USER_DEFINED', associationTypeId: 1 }],
					},
				],
			},
			null,
			2,
		),
		description:
			'JSON body for the batch create labeled associations request. Maximum of 2000 inputs. See <a href="https://developers.hubspot.com/docs/api-reference/latest/crm/associations/associate-records/batch/create-associations-labeled">HubSpot docs</a> for the full schema.',
		displayOptions: {
			show: {
				resource: ['associations'],
				operation: ['assocBatchCreateLabeled'],
			},
		},
	},
];
