import { INodeProperties } from 'n8n-workflow';

import { OBJECT_TYPE_OPTIONS } from '../helpers';

export const propertyDescription: INodeProperties[] = [
	// ── Object Type ───────────────────────────────────────────────────────────
	{
		displayName: 'Object Type',
		name: 'objectType',
		type: 'options',
		typeOptions: { noValidation: true },
		displayOptions: {
			show: {
				resource: ['properties'],
			},
		},
		options: OBJECT_TYPE_OPTIONS,
		default: '0-1',
		description: 'The HubSpot CRM object type whose properties to manage',
	},

	// ── Operation ─────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['properties'],
			},
		},
		options: [
			{
				name: 'Get Property',
				value: 'getProperty',
				description: 'Get a single property and its full definition',
				action: 'Get property',
			},
			{
				name: 'List Properties',
				value: 'listProperties',
				description: 'List all properties for the object type',
				action: 'List properties',
			},
			{
				name: 'List Property Groups',
				value: 'listPropertyGroups',
				description: 'List all property groups for the object type',
				action: 'List property groups',
			},
			{
				name: 'Update Dropdown Options',
				value: 'updateDropdownOptions',
				description: 'Add, remove, or overwrite the dropdown options of an enumeration property',
				action: 'Update dropdown options',
			},
			{
				name: 'Update Property Label',
				value: 'updatePropertyLabel',
				description: "Update a property's label and description",
				action: 'Update property label',
			},
		],
		default: 'listProperties',
	},

	// ── UPDATE PROPERTY LABEL ───────────────────────────────────────────────────
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Property',
		name: 'propertyName',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getProperties',
			loadOptionsDependsOn: ['objectType'],
		},
		default: '',
		description:
			'The property to update. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updatePropertyLabel'],
			},
		},
	},
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		required: true,
		default: '',
		description: 'The new human-readable label for the property',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updatePropertyLabel'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updatePropertyLabelFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updatePropertyLabel'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				description: 'The new help text shown below the property in HubSpot',
			},
		],
	},

	// ── GET PROPERTY ─────────────────────────────────────────────────────────────
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Property',
		name: 'getPropertyName',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getAllProperties',
			loadOptionsDependsOn: ['objectType'],
		},
		default: '',
		description:
			'The property to retrieve. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['getProperty'],
			},
		},
	},

	// ── UPDATE DROPDOWN OPTIONS ─────────────────────────────────────────────────
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Property',
		name: 'dropdownPropertyName',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getEnumerationProperties',
			loadOptionsDependsOn: ['objectType'],
		},
		default: '',
		description:
			'The dropdown (enumeration) property to update. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updateDropdownOptions'],
			},
		},
	},
	{
		displayName: 'Update Mode',
		name: 'dropdownUpdateMode',
		type: 'options',
		noDataExpression: true,
		default: 'add',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updateDropdownOptions'],
			},
		},
		options: [
			{
				name: 'Add Options',
				value: 'add',
				description:
					'Add the given options to the property\'s existing options. If an existing option has the same value as one being added, it is replaced.',
			},
			{
				name: 'Remove Options',
				value: 'remove',
				description: "Remove the given options (matched by value) from the property's existing options",
			},
			{
				name: 'Overwrite All Options',
				value: 'overwrite',
				description: "Replace the property's entire options list with the given options",
			},
		],
	},
	{
		displayName:
			'Overwriting replaces the entire options list. Any existing option not included below is permanently removed and this cannot be undone.',
		name: 'overwriteWarning',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updateDropdownOptions'],
				dropdownUpdateMode: ['overwrite'],
			},
		},
	},
	{
		displayName: 'Values to Remove',
		name: 'removeOptionValues',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'option_one,option_two',
		description: "Comma-separated list of the option's internal values to remove from the property",
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updateDropdownOptions'],
				dropdownUpdateMode: ['remove'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'dropdownOptions',
		type: 'json',
		default: JSON.stringify(
			{
				options: [
					{
						displayOrder: 1,
						hidden: false,
						label: 'Example',
						value: 'example',
						description: '',
					},
				],
			},
			null,
			2,
		),
		description: 'JSON body with the options to add or overwrite with, depending on <em>Update Mode</em>',
		displayOptions: {
			show: {
				resource: ['properties'],
				operation: ['updateDropdownOptions'],
				dropdownUpdateMode: ['add', 'overwrite'],
			},
		},
	},

	// ── LIST PROPERTIES / LIST PROPERTY GROUPS ─────────────────────────────────
	// No additional parameters — both operations use only Object Type above.
];
