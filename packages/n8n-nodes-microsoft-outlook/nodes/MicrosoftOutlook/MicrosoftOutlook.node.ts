import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { messageFields, messageOperations } from './descriptions/MessageDescription';
import { GRAPH_BASE_URL, MAILBOX_FOLDER_PATHS, paginatedMessagesRequest } from './GenericFunctions';

export class MicrosoftOutlook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Microsoft Outlook',
		name: 'microsoftOutlook',
		icon: { light: 'file:microsoftOutlookIcon.svg', dark: 'file:microsoftOutlook.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Microsoft Outlook via the Microsoft Graph API',
		defaults: {
			name: 'Microsoft Outlook',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'microsoftOutlookApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Message', value: 'message' }],
				default: 'message',
			},
			...messageOperations,
			...messageFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'message' && operation === 'searchMessages') {
					const results = await searchMessages.call(this, i);
					returnData.push(...results);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for resource "${resource}"`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function searchMessages(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const mailboxAddress = this.getNodeParameter('mailboxAddress', itemIndex) as string;
	const select = this.getNodeParameter('select', itemIndex, []) as string[];
	const filter = this.getNodeParameter('filter', itemIndex, '') as string;
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const maxResults = this.getNodeParameter('maxResults', itemIndex, 0) as number;
	const returnAllMode = this.getNodeParameter('returnAllMode', itemIndex, 'eachResult') as
		| 'allInOne'
		| 'eachPage'
		| 'eachResult';
	const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as IDataObject;

	const top = (additionalOptions.top as number) ?? 100;
	const skip = (additionalOptions.skip as number) ?? 0;
	const orderBy = (additionalOptions.orderBy as string) ?? '';
	const mailboxFolder = (additionalOptions.mailboxFolder as string) ?? 'all';

	const qs: IDataObject = { $top: top };
	if (select.length) qs.$select = select.join(',');
	if (filter) qs.$filter = filter;
	if (skip > 0) qs.$skip = skip;
	if (orderBy) qs.$orderby = orderBy;

	const encodedMailbox = encodeURIComponent(mailboxAddress);
	const url =
		mailboxFolder === 'all'
			? `${GRAPH_BASE_URL}/users/${encodedMailbox}/messages`
			: `${GRAPH_BASE_URL}/users/${encodedMailbox}/mailFolders/${encodeURIComponent(
					MAILBOX_FOLDER_PATHS[mailboxFolder] ?? mailboxFolder,
			  )}/messages`;

	const pages = await paginatedMessagesRequest.call(
		this,
		url,
		qs,
		{ returnAll, returnAllMode, maxResults },
		itemIndex,
	);

	if (!returnAll || returnAllMode === 'eachPage') {
		return pages.map((page) => ({ json: page, pairedItem: { item: itemIndex } }));
	}

	let allResults: IDataObject[] = pages.flatMap((page) => (page.value as IDataObject[]) ?? []);
	if (maxResults > 0) {
		allResults = allResults.slice(0, maxResults);
	}

	if (returnAllMode === 'allInOne') {
		return [{ json: { value: allResults }, pairedItem: { item: itemIndex } }];
	}

	// eachResult
	return allResults.map((result) => ({ json: result, pairedItem: { item: itemIndex } }));
}
