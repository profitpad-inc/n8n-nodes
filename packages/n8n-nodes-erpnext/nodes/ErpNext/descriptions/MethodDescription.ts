import { INodeProperties } from 'n8n-workflow';

const showForMethod = { resource: ['method'] };

export const methodDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForMethod },
		options: [
			{
				name: 'Call',
				value: 'call',
				description: 'Call a whitelisted server method',
				action: 'Call a method',
			},
		],
		default: 'call',
	},
	{
		displayName: 'Method Path',
		name: 'methodPath',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'frappe.client.get_count',
		displayOptions: { show: showForMethod },
		description: 'Dotted path of the whitelisted method, as used in /api/method/&lt;path&gt;',
	},
	{
		displayName: 'HTTP Method',
		name: 'httpMethod',
		type: 'options',
		options: [
			{ name: 'GET', value: 'GET' },
			{ name: 'POST', value: 'POST' },
		],
		default: 'GET',
		displayOptions: { show: showForMethod },
		description: 'GET for methods that only read, POST for methods that change data',
	},
	{
		displayName: 'Parameters (JSON)',
		name: 'methodParameters',
		type: 'json',
		default: '{}',
		displayOptions: { show: showForMethod },
		description:
			'Arguments for the method. Sent as the query string for GET and as the JSON body for POST.',
	},
];
