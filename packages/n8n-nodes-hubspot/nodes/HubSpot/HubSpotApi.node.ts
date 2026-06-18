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

function parseJsonParam(value: unknown): JsonObject {
	if (typeof value === 'string') return JSON.parse(value) as JsonObject;
	return value as JsonObject;
}

export class HubspotApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HubSpot',
		name: 'hubspotApi',
		icon: 'file:app-icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["objectType"]}}',
		description:
			'Interact with HubSpot CRM objects. Docs: https://developers.hubspot.com/docs/api-reference/latest/crm/using-object-apis',
		usableAsTool: true,
		defaults: {
			name: 'HubSpot',
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
						// eslint-disable-next-line n8n-nodes-base/node-param-resource-with-plural-option
						name: 'Objects',
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
			let delayMs = 0;

			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'objects') {
					const objectType = this.getNodeParameter('objectType', i) as string;
					const objectsPath = `${OBJECTS_BASE_PATH}/${objectType}`;

					// ── GET ──────────────────────────────────────────────────────────
					if (operation === 'get') {
						const objectId = (this.getNodeParameter('objectId', i) as string).trim();
						const opts = this.getNodeParameter('additionalOptions', i) as {
							properties?: string;
							propertiesWithHistory?: string;
							associations?: string;
							idProperty?: string;
							archived?: boolean;
							errorWhenNotFound?: boolean;
							millisecondsBetweenItems?: number;
						};

						delayMs = opts.millisecondsBetweenItems ?? 50;

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

						const errorWhenNotFound = opts.errorWhenNotFound !== false;

						try {
							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{
									method: 'GET',
									url,
									headers: BASE_HEADERS,
								},
							)) as JsonObject;

							returnData.push({
								json: { ...response, objectFound: true },
								pairedItem: { item: i },
							});
						} catch (error) {
							const is404 =
								(error as { httpCode?: string | null }).httpCode === '404' ||
								(error as { response?: { status?: number } }).response?.status === 404;
							if (!errorWhenNotFound && is404) {
								returnData.push({ json: { objectFound: false }, pairedItem: { item: i } });
							} else {
								throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
							}
						}
					}

					// ── LIST ──────────────────────────────────────────────────────────
					if (operation === 'list') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const opts = this.getNodeParameter('listOptions', i) as {
							properties?: string;
							propertiesWithHistory?: string;
							associations?: string;
							after?: string;
							archived?: boolean;
							millisecondsBetweenItems?: number;
						};

						delayMs = opts.millisecondsBetweenItems ?? 50;

						const propertiesList = opts.properties
							? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
							: [];
						const propertiesWithHistoryList = opts.propertiesWithHistory
							? opts.propertiesWithHistory.split(',').map((s) => s.trim()).filter(Boolean)
							: [];
						const associationsList = opts.associations
							? opts.associations.split(',').map((s) => s.trim()).filter(Boolean)
							: [];

						if (returnAll) {
							const maxPages = Math.max(
								1,
								Math.floor(this.getNodeParameter('maxPages', i) as number),
							);
							let after: string | undefined;
							let pageCount = 0;

							do {
								const url = buildHubSpotUrl(HUBSPOT_BASE, objectsPath, {
									limit: 100,
									after,
									properties: propertiesList,
									propertiesWithHistory: propertiesWithHistoryList,
									associations: associationsList,
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

								returnData.push({ json: response, pairedItem: { item: i } });
								pageCount++;

								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as string | undefined;
							} while (after && pageCount < maxPages);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;

							const url = buildHubSpotUrl(HUBSPOT_BASE, objectsPath, {
								limit,
								after: opts.after || undefined,
								properties: propertiesList,
								propertiesWithHistory: propertiesWithHistoryList,
								associations: associationsList,
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

							returnData.push({ json: response, pairedItem: { item: i } });
						}
					}

					// ── CREATE ────────────────────────────────────────────────────────
					if (operation === 'create') {
						const createInputMode = this.getNodeParameter('createInputMode', i) as string;
						const createOpts = this.getNodeParameter('createOptions', i) as {
							millisecondsBetweenItems?: number;
						};

						delayMs = createOpts.millisecondsBetweenItems ?? 50;

						let createProperties: Record<string, unknown>;
						if (createInputMode === 'json') {
							createProperties = parseJsonParam(
								this.getNodeParameter('createJson', i),
							) as Record<string, unknown>;
						} else {
							const propsParam = this.getNodeParameter('createProperties', i) as {
								propertyValues?: Array<{ name: string; value: string }>;
							};
							createProperties = Object.fromEntries(
								(propsParam.propertyValues ?? []).map(({ name, value }) => [name, value]),
							);
						}

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}`,
								headers: BASE_HEADERS,
								body: JSON.stringify({ properties: createProperties }),
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── UPDATE ────────────────────────────────────────────────────────
					if (operation === 'update') {
						const objectId = (this.getNodeParameter('objectId', i) as string).trim();
						const updateInputMode = this.getNodeParameter('updateInputMode', i) as string;
						const updateOpts = this.getNodeParameter('updateOptions', i) as {
							idProperty?: string;
							millisecondsBetweenItems?: number;
						};

						delayMs = updateOpts.millisecondsBetweenItems ?? 50;

						let updateProperties: Record<string, unknown>;
						if (updateInputMode === 'json') {
							updateProperties = parseJsonParam(
								this.getNodeParameter('updateJson', i),
							) as Record<string, unknown>;
						} else {
							const updateParam = this.getNodeParameter('updateFields', i) as {
								propertyValues?: Array<{ name: string; value: string }>;
							};
							updateProperties = Object.fromEntries(
								(updateParam.propertyValues ?? []).map(({ name, value }) => [name, value]),
							);
						}

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
								body: JSON.stringify({ properties: updateProperties }),
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── DELETE ────────────────────────────────────────────────────────
					if (operation === 'delete') {
						const objectId = (this.getNodeParameter('objectId', i) as string).trim();
						const deleteOpts = this.getNodeParameter('deleteOptions', i) as {
							idProperty?: string;
							millisecondsBetweenItems?: number;
						};

						delayMs = deleteOpts.millisecondsBetweenItems ?? 50;

						let realObjectId = objectId;

						if (deleteOpts.idProperty) {
							const getUrl = buildHubSpotUrl(HUBSPOT_BASE, `${objectsPath}/${objectId}`, {
								idProperty: deleteOpts.idProperty,
							});

							const getResponse = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{ method: 'GET', url: getUrl, headers: BASE_HEADERS },
							)) as { id: string };

							realObjectId = getResponse.id;
						}

						await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
							method: 'DELETE',
							url: `${HUBSPOT_BASE}${objectsPath}/${realObjectId}`,
							headers: BASE_HEADERS,
						});

						returnData.push({
							json: { success: true, id: realObjectId },
							pairedItem: { item: i },
						});
					}

					// ── SEARCH ────────────────────────────────────────────────────────
					if (operation === 'search') {
						const searchBodyRaw = this.getNodeParameter('searchBody', i);
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const searchOpts = this.getNodeParameter('searchOptions', i) as {
							millisecondsBetweenItems?: number;
						};

						delayMs = searchOpts.millisecondsBetweenItems ?? 50;

						const searchBodyBase = parseJsonParam(searchBodyRaw);
						const searchUrl = `${HUBSPOT_BASE}${objectsPath}/search`;

						if (returnAll) {
							const maxPages = Math.max(
								1,
								Math.floor(this.getNodeParameter('maxPages', i) as number),
							);
							let pageCount = 0;
							let after: string | undefined;

							do {
								const pageBody: JsonObject = {
									...searchBodyBase,
									limit: 200,
									...(after ? { after } : {}),
								};

								const response = (await this.helpers.httpRequestWithAuthentication.call(
									this,
									'hubspotApi',
									{
										method: 'POST',
										url: searchUrl,
										headers: BASE_HEADERS,
										body: JSON.stringify(pageBody),
									},
								)) as JsonObject;

								returnData.push({ json: response, pairedItem: { item: i } });
								pageCount++;

								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as string | undefined;
							} while (after && pageCount < maxPages);
						} else {
							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{
									method: 'POST',
									url: searchUrl,
									headers: BASE_HEADERS,
									body: JSON.stringify(searchBodyBase),
								},
							)) as JsonObject;

							returnData.push({ json: response, pairedItem: { item: i } });
						}
					}

					// ── BATCH READ ────────────────────────────────────────────────────
					if (operation === 'batchRead') {
						const body = parseJsonParam(this.getNodeParameter('batchReadBody', i));

						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}/batch/read`,
								headers: BASE_HEADERS,
								body: JSON.stringify(body),
							},
						)) as JsonObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── BATCH CREATE ──────────────────────────────────────────────────
					if (operation === 'batchCreate') {
						const body = parseJsonParam(this.getNodeParameter('batchCreateBody', i));

						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}/batch/create`,
								headers: BASE_HEADERS,
								body: JSON.stringify(body),
							},
						)) as JsonObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── BATCH UPSERT ──────────────────────────────────────────────────
					if (operation === 'batchUpsert') {
						const body = parseJsonParam(this.getNodeParameter('batchUpsertBody', i));

						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}/batch/upsert`,
								headers: BASE_HEADERS,
								body: JSON.stringify(body),
							},
						)) as JsonObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── BATCH DELETE ──────────────────────────────────────────────────
					if (operation === 'batchDelete') {
						const body = parseJsonParam(this.getNodeParameter('batchDeleteBody', i));

						await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
							method: 'POST',
							url: `${HUBSPOT_BASE}${objectsPath}/batch/archive`,
							headers: BASE_HEADERS,
							body: JSON.stringify(body),
						});

						returnData.push({ json: { success: true }, pairedItem: { item: i } });
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

			if (delayMs > 0 && i < items.length - 1) {
				// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
				await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return [returnData];
	}
}
