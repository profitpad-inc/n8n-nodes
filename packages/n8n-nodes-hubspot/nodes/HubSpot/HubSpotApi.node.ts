import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
} from 'n8n-workflow';

import { objectDescription } from './descriptions/ObjectDescription';
import { buildHubSpotUrl } from './helpers';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const OBJECTS_BASE_PATH = '/crm/v3/objects';

const BASE_HEADERS = {
	'content-type': 'application/json',
	accept: 'application/json',
};

export class HubspotApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HubSpot-P',
		name: 'hubspotApi',
		icon: 'file:app-icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["objectType"]}}',
		description:
			'Interact with HubSpot CRM objects. Docs: https://developers.hubspot.com/docs/api-reference/latest/crm/using-object-apis',
		usableAsTool: true,
		defaults: {
			name: 'HubSpot-P',
		},
		inputs: [NodeConnectionTypes.Main],
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
					{
						name: 'Object',
						value: 'objects',
						description:
							'Work with HubSpot CRM objects — contacts, companies, deals, and more',
					},
				],
				default: 'objects',
			},
			...objectDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'objects') {
					const objectType = this.getNodeParameter('objectType', i) as string;
					const objectsPath = `${OBJECTS_BASE_PATH}/${objectType}`;

					// ── GET ────────────────────────────────────────────────────────
					if (operation === 'get') {
						const objectId = (this.getNodeParameter('objectId', i) as string).trim();
						const opts = this.getNodeParameter('additionalOptions', i) as {
							properties?: string;
							propertiesWithHistory?: string;
							associations?: string;
							idProperty?: string;
							archived?: boolean;
						};

						const propertiesList = opts.properties
							? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
							: [];
						const propertiesWithHistoryList = opts.propertiesWithHistory
							? opts.propertiesWithHistory.split(',').map((s) => s.trim()).filter(Boolean)
							: [];
						const associationsList = opts.associations
							? opts.associations.split(',').map((s) => s.trim()).filter(Boolean)
							: [];

						const url = buildHubSpotUrl(HUBSPOT_BASE, `${objectsPath}/${objectId}`, {
							properties: propertiesList,
							propertiesWithHistory: propertiesWithHistoryList,
							associations: associationsList,
							idProperty: opts.idProperty || undefined,
							archived: opts.archived,
						});

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'GET',
								url,
								headers: BASE_HEADERS,
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── GET MANY ───────────────────────────────────────────────────
					if (operation === 'getMany') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const opts = this.getNodeParameter('listOptions', i) as {
							properties?: string;
							after?: string;
							archived?: boolean;
						};

						const propertiesList = opts.properties
							? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
							: [];

						if (returnAll) {
							let after: string | undefined;

							do {
								const url = buildHubSpotUrl(HUBSPOT_BASE, objectsPath, {
									limit: 100,
									after,
									properties: propertiesList,
									archived: opts.archived,
								});

								const response = (await this.helpers.httpRequestWithAuthentication.call(
									this,
									'hubspotApi',
									{
										method: 'GET',
										url,
										headers: BASE_HEADERS,
									},
								)) as JsonObject;

								const results = (response.results as JsonObject[]) ?? [];
								for (const result of results) {
									returnData.push({ json: result, pairedItem: { item: i } });
								}

								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as
									| string
									| undefined;
							} while (after);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;

							const url = buildHubSpotUrl(HUBSPOT_BASE, objectsPath, {
								limit,
								after: opts.after || undefined,
								properties: propertiesList,
								archived: opts.archived,
							});

							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{
									method: 'GET',
									url,
									headers: BASE_HEADERS,
								},
							)) as JsonObject;

							const results = (response.results as JsonObject[]) ?? [];
							for (const result of results) {
								returnData.push({ json: result, pairedItem: { item: i } });
							}
						}
					}

					// ── CREATE ─────────────────────────────────────────────────────
					if (operation === 'create') {
						const propsParam = this.getNodeParameter('createProperties', i) as {
							propertyValues?: Array<{ name: string; value: string }>;
						};

						const properties = Object.fromEntries(
							(propsParam.propertyValues ?? []).map(({ name, value }) => [name, value]),
						);

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}`,
								headers: BASE_HEADERS,
								body: JSON.stringify({ properties }),
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── UPDATE ─────────────────────────────────────────────────────
					if (operation === 'update') {
						const objectId = (this.getNodeParameter('objectId', i) as string).trim();
						const updateParam = this.getNodeParameter('updateFields', i) as {
							propertyValues?: Array<{ name: string; value: string }>;
						};
						const updateOpts = this.getNodeParameter('updateOptions', i) as {
							idProperty?: string;
						};

						const properties = Object.fromEntries(
							(updateParam.propertyValues ?? []).map(({ name, value }) => [name, value]),
						);

						const url = buildHubSpotUrl(HUBSPOT_BASE, `${objectsPath}/${objectId}`, {
							idProperty: updateOpts.idProperty || undefined,
						});

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'PATCH',
								url,
								headers: BASE_HEADERS,
								body: JSON.stringify({ properties }),
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
