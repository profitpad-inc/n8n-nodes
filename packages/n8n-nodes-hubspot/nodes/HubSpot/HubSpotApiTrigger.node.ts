import {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

export class HubspotApiTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HubSpot Trigger',
		name: 'hubspotApiTrigger',
		icon: 'file:app-icon.svg',
		group: ['trigger'],
		version: 1,
		description: 'Polls for new or updated HubSpot records on a schedule.',
		subtitle: '={{$parameter["resource"]}}',
		defaults: {
			name: 'HubSpot Trigger',
		},
		polling: true,
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'hubspotApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Contact', value: 'contact' },
				],
				default: 'contact',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		return null;
	}
}
