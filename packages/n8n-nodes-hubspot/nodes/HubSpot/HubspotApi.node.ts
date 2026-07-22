import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { associationDescription } from './descriptions/AssociationDescription';
import { objectDescription } from './descriptions/ObjectDescription';
import { ownerDescription } from './descriptions/OwnerDescription';
import { propertyDescription } from './descriptions/PropertyDescription';
import {
	buildHubSpotUrl,
	findOwnerByField,
	getAllProperties,
	getAssociationTypeIds,
	getEnumerationProperties,
	getProperties,
	getSearchFilterProperties,
	getSearchOperators,
	getUniqueProperties,
	getUniquePropertiesForAssociationFrom,
	getUniquePropertiesForAssociationTo,
	getWritableProperties,
	OWNERS_BASE_PATH,
	resolveUsersLookup,
	UsersLookup,
} from './helpers';
import { resolveSearchInput, toStringList, UiFilterGroups, UiSorts } from './searchFilter';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const OBJECTS_BASE_PATH = '/crm/v3/objects';
const ASSOC_BASE_PATH = '/crm/associations/2026-03';
const PROPERTIES_BASE_PATH = '/crm/properties/2026-03';
const USERS_OBJECT_PATH = `${OBJECTS_BASE_PATH}/users`;
const USERS_ALWAYS_INCLUDED_PROPERTIES = [
	'hs_internal_user_id',
	'hs_searchable_calculated_name',
	'hs_family_name',
	'hs_given_name',
	'hs_email',
];

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
		subtitle:
			'={{$parameter["resource"] === "associations" ? ($parameter["operation"] + ": " + ($parameter["fromObjectType"] || "") + " → " + ($parameter["toObjectType"] || "")) : ($parameter["operation"] + ": " + ($parameter["objectType"] || ""))}}',
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
						name: 'Associations',
						value: 'associations',
						description: 'Manage associations between HubSpot CRM records',
					},
					{
						name: 'Objects',
						value: 'objects',
						description:
							'Work with HubSpot CRM objects — contacts, companies, deals, and more',
					},
					{
						name: 'Owners',
						value: 'owners',
						description: 'Work with HubSpot users and the owners assigned to CRM records',
					},
					{
						name: 'Properties',
						value: 'properties',
						description: 'Manage HubSpot CRM property definitions and their dropdown options',
					},
				],
				default: 'objects',
			},
			...associationDescription,
			...objectDescription,
			...ownerDescription,
			...propertyDescription,
		],
	};

	methods = {
		loadOptions: {
			getProperties,
			getEnumerationProperties,
			getAllProperties,
			getSearchFilterProperties,
			getSearchOperators,
			getWritableProperties,
			getUniqueProperties,
			getUniquePropertiesForAssociationFrom,
			getUniquePropertiesForAssociationTo,
			getAssociationTypeIds,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			let delayMs = 0;

			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'associations') {
					const fromObjectType = this.getNodeParameter('fromObjectType', i) as string;
					const toObjectType = this.getNodeParameter('toObjectType', i) as string;
					const assocBase = `${HUBSPOT_BASE}${ASSOC_BASE_PATH}/${fromObjectType}/${toObjectType}`;

					// ── ASSOC BATCH READ ──────────────────────────────────────────────
					if (operation === 'assocBatchRead') {
						const fromIdsRaw = String(this.getNodeParameter('fromIds', i)).trim();
						const fromIdProperty = (
							this.getNodeParameter('fromIdProperty', i) as string
						).trim();

						let fromIds = fromIdsRaw
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean);

						if (fromIdProperty) {
							const resolvedIds: string[] = [];
							for (let j = 0; j < fromIds.length; j += 100) {
								const batch = fromIds.slice(j, j + 100);
								const batchResponse = (await this.helpers.httpRequestWithAuthentication.call(
									this,
									'hubspotApi',
									{
										method: 'POST',
										url: `${HUBSPOT_BASE}${OBJECTS_BASE_PATH}/${fromObjectType}/batch/read`,
										headers: BASE_HEADERS,
										body: JSON.stringify({
											inputs: batch.map((id) => ({ id })),
											idProperty: fromIdProperty,
										}),
									},
								)) as { results?: Array<{ id: string }> };
								resolvedIds.push(...(batchResponse.results ?? []).map((r) => r.id));
							}
							fromIds = resolvedIds;
						}

						if (fromIds.length === 0) {
							returnData.push({
								json: { status: 'COMPLETE', results: [], numErrors: 0 },
								pairedItem: { item: i },
							});
						} else {
							for (let j = 0; j < fromIds.length; j += 1000) {
								const batch = fromIds.slice(j, j + 1000);
								const response = (await this.helpers.httpRequestWithAuthentication.call(
									this,
									'hubspotApi',
									{
										method: 'POST',
										url: `${assocBase}/batch/read`,
										headers: BASE_HEADERS,
										body: JSON.stringify({ inputs: batch.map((id) => ({ id })) }),
									},
								)) as JsonObject;
								returnData.push({ json: response, pairedItem: { item: i } });
							}
						}
					}

					// ── ASSOC BATCH DELETE ────────────────────────────────────────────
					if (operation === 'assocBatchDelete') {
						const body = parseJsonParam(this.getNodeParameter('assocBatchDeleteBody', i));
						await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
							method: 'POST',
							url: `${assocBase}/batch/archive`,
							headers: BASE_HEADERS,
							body: JSON.stringify(body),
						});
						returnData.push({ json: { success: true }, pairedItem: { item: i } });
					}

					// ── ASSOC BATCH CREATE DEFAULT ────────────────────────────────────
					if (operation === 'assocBatchCreateDefault') {
						const body = parseJsonParam(
							this.getNodeParameter('assocBatchCreateDefaultBody', i),
						);
						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${assocBase}/batch/associate/default`,
								headers: BASE_HEADERS,
								body: JSON.stringify(body),
							},
						)) as JsonObject;
						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── ASSOC BATCH CREATE LABELED ────────────────────────────────────
					if (operation === 'assocBatchCreateLabeled') {
						const body = parseJsonParam(
							this.getNodeParameter('assocBatchCreateLabeledBody', i),
						);
						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${assocBase}/batch/create`,
								headers: BASE_HEADERS,
								body: JSON.stringify(body),
							},
						)) as JsonObject;
						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── ASSOC READ LABELS ─────────────────────────────────────────────
					if (operation === 'assocReadLabels') {
						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'GET',
								url: `${assocBase}/labels`,
								headers: BASE_HEADERS,
							},
						)) as JsonObject;
						returnData.push({ json: response, pairedItem: { item: i } });
					}
				}

				if (resource === 'objects') {
					const objectType = this.getNodeParameter('objectType', i) as string;
					const objectsPath = `${OBJECTS_BASE_PATH}/${objectType}`;

					// ── GET ──────────────────────────────────────────────────────────
					if (operation === 'get') {
						const objectId = String(this.getNodeParameter('objectId', i)).trim();
						const opts = this.getNodeParameter('additionalOptions', i) as {
							properties?: string | string[];
							propertiesWithHistory?: string | string[];
							associations?: string | string[];
							idProperty?: string;
							archived?: boolean;
							errorWhenNotFound?: boolean;
							millisecondsBetweenItems?: number;
						};

						delayMs = opts.millisecondsBetweenItems ?? 50;

						const propertiesList = toStringList(opts.properties);
						const propertiesWithHistoryList = toStringList(opts.propertiesWithHistory);
						const associationsList = toStringList(opts.associations);

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
							properties?: string | string[];
							propertiesWithHistory?: string | string[];
							associations?: string | string[];
							after?: string;
							archived?: boolean;
							millisecondsBetweenItems?: number;
						};

						delayMs = opts.millisecondsBetweenItems ?? 50;

						const propertiesList = toStringList(opts.properties);
						const propertiesWithHistoryList = toStringList(opts.propertiesWithHistory);
						const associationsList = toStringList(opts.associations);

						if (returnAll) {
							const maxPages = Math.max(
								1,
								Math.floor(this.getNodeParameter('maxPages', i) as number),
							);
							const returnAllMode = this.getNodeParameter('returnAllMode', i) as string;
							let after: string | undefined;
							let pageCount = 0;
							const allResults: JsonObject[] = [];

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

								const results = (response.results as JsonObject[] | undefined) ?? [];

								if (returnAllMode === 'eachPage') {
									returnData.push({ json: response, pairedItem: { item: i } });
								} else if (returnAllMode === 'eachResult') {
									for (const result of results) {
										returnData.push({ json: result, pairedItem: { item: i } });
									}
								} else {
									allResults.push(...results);
								}

								pageCount++;
								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as string | undefined;
							} while (after && pageCount < maxPages);

							if (returnAllMode === 'allInOne') {
								returnData.push({ json: { results: allResults }, pairedItem: { item: i } });
							}
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

						let createAssociations: unknown[];
						if (createInputMode === 'json') {
							const parsedAssociations = parseJsonParam(
								this.getNodeParameter('createAssociationsJson', i),
							) as unknown;
							createAssociations = Array.isArray(parsedAssociations) ? parsedAssociations : [];
						} else {
							const createAssocParam = this.getNodeParameter('createAssociations', i) as {
								associationValues?: Array<{
									toObjectType: string;
									toObjectId: string;
									toIdProperty?: string;
									associationTypeIds: string | string[];
									associationCategory: string;
								}>;
							};

							createAssociations = [];
							for (const assoc of createAssocParam.associationValues ?? []) {
								let resolvedToId = String(assoc.toObjectId).trim();
								const toIdProperty = (assoc.toIdProperty ?? '').trim();

								if (toIdProperty) {
									const resolveUrl = buildHubSpotUrl(
										HUBSPOT_BASE,
										`${OBJECTS_BASE_PATH}/${assoc.toObjectType}/${resolvedToId}`,
										{ idProperty: toIdProperty },
									);
									const resolveResponse = (await this.helpers.httpRequestWithAuthentication.call(
										this,
										'hubspotApi',
										{ method: 'GET', url: resolveUrl, headers: BASE_HEADERS },
									)) as { id: string };
									resolvedToId = resolveResponse.id;
								}

								createAssociations.push({
									to: { id: resolvedToId },
									types: toStringList(assoc.associationTypeIds).map((associationTypeId) => ({
										associationTypeId: Number(associationTypeId),
										associationCategory: assoc.associationCategory,
									})),
								});
							}
						}

						const createBody: Record<string, unknown> = { properties: createProperties };
						if (createAssociations.length > 0) {
							createBody.associations = createAssociations;
						}

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}`,
								headers: BASE_HEADERS,
								body: JSON.stringify(createBody),
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── UPDATE ────────────────────────────────────────────────────────
					if (operation === 'update') {
						const objectId = String(this.getNodeParameter('objectId', i)).trim();
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
						const objectId = String(this.getNodeParameter('objectId', i)).trim();
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
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const searchOpts = this.getNodeParameter('searchOptions', i) as {
							query?: string;
							sortsUi?: UiSorts;
							sortsJson?: string;
							millisecondsBetweenItems?: number;
						};

						delayMs = searchOpts.millisecondsBetweenItems ?? 50;

						// Back-compat: workflows built before the Fields/Custom JSON split
						// stored the whole search request under a `searchBody` parameter
						// that no longer exists in this node's UI. If it still has a value,
						// treat it as the Custom JSON input so those workflows keep running
						// instead of silently searching with no filters.
						const legacySearchBody = (
							this.getNodeParameter('searchBody', i, '') as string
						).trim();
						const searchInputMode = legacySearchBody
							? 'json'
							: (this.getNodeParameter('searchInputMode', i) as string);

						const resolved = resolveSearchInput({
							searchInputMode,
							filterJson:
								legacySearchBody || (this.getNodeParameter('filterJson', i, '') as string),
							filterGroupsUi: this.getNodeParameter('filterGroupsUi', i, {}) as UiFilterGroups,
							sortsJson: searchOpts.sortsJson,
							sortsUi: searchOpts.sortsUi,
						});

						if (resolved.invalidFilterJson) {
							throw new NodeOperationError(this.getNode(), 'Filters (JSON) is not valid JSON', {
								itemIndex: i,
							});
						}
						if (resolved.invalidSortsJson) {
							throw new NodeOperationError(this.getNode(), 'Sorts (JSON) is not valid JSON', {
								itemIndex: i,
							});
						}

						const searchPropertiesList = toStringList(
							this.getNodeParameter('properties', i) as string | string[],
						);
						const query = (searchOpts.query ?? '').trim();

						const searchBodyBase: JsonObject = {
							...resolved.baseSearchBody,
							filterGroups: resolved.filterGroups,
							sorts: resolved.sorts.length
								? resolved.sorts
								: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
							...(searchPropertiesList.length ? { properties: searchPropertiesList } : {}),
							...(query ? { query } : {}),
						};
						const searchUrl = `${HUBSPOT_BASE}${objectsPath}/search`;

						if (returnAll) {
							const maxPages = Math.max(
								1,
								Math.floor(this.getNodeParameter('maxPages', i) as number),
							);
							const returnAllMode = this.getNodeParameter('returnAllMode', i) as string;
							let pageCount = 0;
							let after: string | undefined;
							const allResults: JsonObject[] = [];

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

								const results = (response.results as JsonObject[] | undefined) ?? [];

								if (returnAllMode === 'eachPage') {
									returnData.push({ json: response, pairedItem: { item: i } });
								} else if (returnAllMode === 'eachResult') {
									for (const result of results) {
										returnData.push({ json: result, pairedItem: { item: i } });
									}
								} else {
									allResults.push(...results);
								}

								pageCount++;
								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as string | undefined;
							} while (after && pageCount < maxPages);

							if (returnAllMode === 'allInOne') {
								returnData.push({ json: { results: allResults }, pairedItem: { item: i } });
							}
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{
									method: 'POST',
									url: searchUrl,
									headers: BASE_HEADERS,
									body: JSON.stringify({ ...searchBodyBase, limit }),
								},
							)) as JsonObject;

							returnData.push({ json: response, pairedItem: { item: i } });
						}
					}

					// ── BATCH READ ────────────────────────────────────────────────────
					if (operation === 'batchRead') {
						const batchReadInputMode = this.getNodeParameter(
							'batchReadInputMode',
							i,
						) as string;

						if (batchReadInputMode === 'json') {
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
						} else {
							const objectIds = String(this.getNodeParameter('batchReadObjectIds', i))
								.split(',')
								.map((s) => s.trim())
								.filter(Boolean);
							const returnAll = this.getNodeParameter('batchReadReturnAll', i) as boolean;
							const opts = this.getNodeParameter('batchReadOptions', i) as {
								properties?: string;
								propertiesWithHistory?: string;
								idProperty?: string;
								millisecondsBetweenItems?: number;
							};

							delayMs = opts.millisecondsBetweenItems ?? 50;

							const propertiesList = opts.properties
								? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
								: [];
							const propertiesWithHistoryList = opts.propertiesWithHistory
								? opts.propertiesWithHistory.split(',').map((s) => s.trim()).filter(Boolean)
								: [];

							const idsToProcess = returnAll
								? objectIds
								: objectIds.slice(0, this.getNodeParameter('batchReadLimit', i) as number);

							const maxPages = returnAll
								? Math.max(
										1,
										Math.floor(this.getNodeParameter('batchReadMaxPages', i) as number),
									)
								: 1;
							const returnAllMode = returnAll
								? (this.getNodeParameter('batchReadReturnAllMode', i) as string)
								: 'eachPage';

							const chunks: string[][] = [];
							for (let c = 0; c < idsToProcess.length; c += 100) {
								chunks.push(idsToProcess.slice(c, c + 100));
							}

							const allResults: JsonObject[] = [];

							for (const [pageIndex, chunk] of chunks.entries()) {
								if (pageIndex >= maxPages) break;

								const body: JsonObject = {
									inputs: chunk.map((id) => ({ id })),
									...(propertiesList.length ? { properties: propertiesList } : {}),
									...(propertiesWithHistoryList.length
										? { propertiesWithHistory: propertiesWithHistoryList }
										: {}),
									...(opts.idProperty ? { idProperty: opts.idProperty } : {}),
								};

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

								const results = (response.results as JsonObject[] | undefined) ?? [];

								if (returnAllMode === 'eachPage') {
									returnData.push({ json: response, pairedItem: { item: i } });
								} else if (returnAllMode === 'eachResult') {
									for (const result of results) {
										returnData.push({ json: result, pairedItem: { item: i } });
									}
								} else {
									allResults.push(...results);
								}
							}

							if (returnAllMode === 'allInOne') {
								returnData.push({ json: { results: allResults }, pairedItem: { item: i } });
							}
						}
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

					// ── BATCH UPDATE ──────────────────────────────────────────────────
					if (operation === 'batchUpdate') {
						const body = parseJsonParam(this.getNodeParameter('batchUpdateBody', i));

						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'POST',
								url: `${HUBSPOT_BASE}${objectsPath}/batch/update`,
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

					// ── MERGE ────────────────────────────────────────────────────────
					if (operation === 'merge') {
						const primaryObjectId = String(
							this.getNodeParameter('primaryObjectId', i),
						).trim();
						const objectIdsToMergeRaw = String(
							this.getNodeParameter('objectIdsToMerge', i),
						).trim();
						const preserveFromPrimaryRaw = String(
							this.getNodeParameter('preserveFromPrimary', i) ?? '',
						).trim();
						const mergeOpts = this.getNodeParameter('mergeOptions', i) as {
							millisecondsBetweenItems?: number;
						};

						delayMs = mergeOpts.millisecondsBetweenItems ?? 50;

						const secondaryIds = objectIdsToMergeRaw
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean);

						const propertiesToPreserve = preserveFromPrimaryRaw
							? preserveFromPrimaryRaw.split(',').map((s) => s.trim()).filter(Boolean)
							: [];

						// Step 1: Read primary's properties before any merges
						const preservedValues: Record<string, unknown> = {};
						if (propertiesToPreserve.length > 0) {
							const getUrl = buildHubSpotUrl(
								HUBSPOT_BASE,
								`${objectsPath}/${primaryObjectId}`,
								{ properties: propertiesToPreserve },
							);
							const primaryRecord = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{ method: 'GET', url: getUrl, headers: BASE_HEADERS },
							)) as { properties?: Record<string, unknown> };

							const allProps = primaryRecord.properties ?? {};
							for (const prop of propertiesToPreserve) {
								if (allProps[prop] !== undefined && allProps[prop] !== null && allProps[prop] !== '') {
									preservedValues[prop] = allProps[prop];
								}
							}
						}

						// Step 2: Merge each secondary into the current primary sequentially
						let currentPrimaryId = primaryObjectId;
						let mergeResponse: JsonObject = {};

						for (const secondaryId of secondaryIds) {
							mergeResponse = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{
									method: 'POST',
									url: `${HUBSPOT_BASE}${objectsPath}/merge`,
									headers: BASE_HEADERS,
									body: JSON.stringify({
										primaryObjectId: currentPrimaryId,
										objectIdToMerge: secondaryId,
									}),
								},
							)) as JsonObject;

							currentPrimaryId = (mergeResponse.id as string) ?? currentPrimaryId;
						}

						// Step 3: Restore preserved property values on the surviving record
						if (Object.keys(preservedValues).length > 0) {
							await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
								method: 'PATCH',
								url: `${HUBSPOT_BASE}${objectsPath}/${currentPrimaryId}`,
								headers: BASE_HEADERS,
								body: JSON.stringify({ properties: preservedValues }),
							});
						}

						returnData.push({
							json: { ...mergeResponse, survivingId: currentPrimaryId },
							pairedItem: { item: i },
						});
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

				if (resource === 'owners') {
					const objectType = this.getNodeParameter('objectType', i) as string;

					const fetchLinkedUser = async (
						userId: number | string | null | undefined,
					): Promise<JsonObject | null> => {
						if (userId === undefined || userId === null) return null;
						const userUrl = buildHubSpotUrl(HUBSPOT_BASE, `${USERS_OBJECT_PATH}/${userId}`, {
							idProperty: 'hs_internal_user_id',
							properties: USERS_ALWAYS_INCLUDED_PROPERTIES,
						});
						try {
							return (await this.helpers.httpRequestWithAuthentication.call(this, 'hubspotApi', {
								method: 'GET',
								url: userUrl,
								headers: BASE_HEADERS,
							})) as JsonObject;
						} catch {
							return null;
						}
					};

					const fetchLinkedOwner = async (
						hsInternalUserId: unknown,
						archived: boolean,
					): Promise<JsonObject | null> => {
						if (hsInternalUserId === undefined || hsInternalUserId === null || hsInternalUserId === '') {
							return null;
						}
						const match = await findOwnerByField.call(
							this,
							'userId',
							String(hsInternalUserId),
							archived,
						);
						return (match as JsonObject | undefined) ?? null;
					};

					// ── GET ──────────────────────────────────────────────────────────
					if (operation === 'get') {
						const objectId = String(this.getNodeParameter('objectId', i)).trim();
						const idProperty = String(this.getNodeParameter('idProperty', i)).trim();

						if (objectType === 'users') {
							const opts = this.getNodeParameter('additionalOptions', i) as {
								properties?: string;
								propertiesWithHistory?: string;
								archived?: boolean;
								errorWhenNotFound?: boolean;
								millisecondsBetweenItems?: number;
							};

							delayMs = opts.millisecondsBetweenItems ?? 50;
							const errorWhenNotFound = opts.errorWhenNotFound !== false;

							let lookup: UsersLookup | undefined;
							try {
								lookup = await resolveUsersLookup.call(this, idProperty, objectId, i);
							} catch (error) {
								if (errorWhenNotFound) {
									throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
								}
							}

							if (!lookup) {
								returnData.push({ json: { objectFound: false }, pairedItem: { item: i } });
							} else {
								const propertiesList = Array.from(
									new Set([
										...USERS_ALWAYS_INCLUDED_PROPERTIES,
										...(opts.properties
											? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
											: []),
									]),
								);
								const propertiesWithHistoryList = opts.propertiesWithHistory
									? opts.propertiesWithHistory.split(',').map((s) => s.trim()).filter(Boolean)
									: [];

								const url = buildHubSpotUrl(HUBSPOT_BASE, `${USERS_OBJECT_PATH}/${lookup.realId}`, {
									properties: propertiesList,
									propertiesWithHistory: propertiesWithHistoryList,
									idProperty: lookup.idPropertyParam,
									archived: opts.archived,
								});

								try {
									const response = (await this.helpers.httpRequestWithAuthentication.call(
										this,
										'hubspotApi',
										{ method: 'GET', url, headers: BASE_HEADERS },
									)) as JsonObject;

									const responseProperties =
										(response.properties as JsonObject | undefined) ?? {};
									const owner = await fetchLinkedOwner(
										responseProperties.hs_internal_user_id,
										opts.archived ?? false,
									);

									returnData.push({
										json: { ...response, objectFound: true, owner },
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
						} else {
							const opts = this.getNodeParameter('additionalOptions', i) as {
								archived?: boolean;
								errorWhenNotFound?: boolean;
								millisecondsBetweenItems?: number;
							};

							delayMs = opts.millisecondsBetweenItems ?? 50;
							const errorWhenNotFound = opts.errorWhenNotFound !== false;
							const archived = opts.archived ?? false;

							if (idProperty === 'ownerId' || idProperty === 'id') {
								const url = buildHubSpotUrl(HUBSPOT_BASE, `${OWNERS_BASE_PATH}/${objectId}`, {
									archived,
								});

								try {
									const response = (await this.helpers.httpRequestWithAuthentication.call(
										this,
										'hubspotApi',
										{ method: 'GET', url, headers: BASE_HEADERS },
									)) as JsonObject;

									const user = await fetchLinkedUser(
										response.userId as number | string | null | undefined,
									);

									returnData.push({
										json: { ...response, objectFound: true, user },
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
							} else {
								const match = await findOwnerByField.call(this, idProperty, objectId, archived);

								if (match) {
									const user = await fetchLinkedUser(
										match.userId as number | string | null | undefined,
									);

									returnData.push({
										json: { ...match, objectFound: true, user },
										pairedItem: { item: i },
									});
								} else if (!errorWhenNotFound) {
									returnData.push({ json: { objectFound: false }, pairedItem: { item: i } });
								} else {
									throw new NodeOperationError(
										this.getNode(),
										`No owner found where "${idProperty}" is "${objectId}"`,
										{ itemIndex: i },
									);
								}
							}
						}
					}

					// ── LIST ─────────────────────────────────────────────────────────
					if (operation === 'list') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const opts = this.getNodeParameter('listOptions', i) as {
							after?: string;
							archived?: boolean;
							properties?: string;
							propertiesWithHistory?: string;
							millisecondsBetweenItems?: number;
						};

						delayMs = opts.millisecondsBetweenItems ?? 50;

						const basePath = objectType === 'users' ? USERS_OBJECT_PATH : OWNERS_BASE_PATH;
						const propertiesList =
							objectType === 'users'
								? Array.from(
										new Set([
											...USERS_ALWAYS_INCLUDED_PROPERTIES,
											...(opts.properties
												? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
												: []),
										]),
									)
								: [];
						const propertiesWithHistoryList =
							objectType === 'users' && opts.propertiesWithHistory
								? opts.propertiesWithHistory.split(',').map((s) => s.trim()).filter(Boolean)
								: [];

						if (returnAll) {
							const maxPages = Math.max(
								1,
								Math.floor(this.getNodeParameter('maxPages', i) as number),
							);
							const returnAllMode = this.getNodeParameter('returnAllMode', i) as string;
							let after: string | undefined;
							let pageCount = 0;
							const allResults: JsonObject[] = [];

							do {
								const url = buildHubSpotUrl(HUBSPOT_BASE, basePath, {
									limit: 100,
									after,
									properties: propertiesList,
									propertiesWithHistory: propertiesWithHistoryList,
									archived: opts.archived,
								});

								const response = (await this.helpers.httpRequestWithAuthentication.call(
									this,
									'hubspotApi',
									{ method: 'GET', url, headers: BASE_HEADERS },
								)) as JsonObject;

								const results = (response.results as JsonObject[] | undefined) ?? [];

								if (returnAllMode === 'eachPage') {
									returnData.push({ json: response, pairedItem: { item: i } });
								} else if (returnAllMode === 'eachResult') {
									for (const result of results) {
										returnData.push({ json: result, pairedItem: { item: i } });
									}
								} else {
									allResults.push(...results);
								}

								pageCount++;
								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as string | undefined;
							} while (after && pageCount < maxPages);

							if (returnAllMode === 'allInOne') {
								returnData.push({ json: { results: allResults }, pairedItem: { item: i } });
							}
						} else {
							const limit = this.getNodeParameter('limit', i) as number;

							const url = buildHubSpotUrl(HUBSPOT_BASE, basePath, {
								limit,
								after: opts.after || undefined,
								properties: propertiesList,
								propertiesWithHistory: propertiesWithHistoryList,
								archived: opts.archived,
							});

							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{ method: 'GET', url, headers: BASE_HEADERS },
							)) as JsonObject;

							returnData.push({ json: response, pairedItem: { item: i } });
						}
					}

					// ── SEARCH (Users only) ───────────────────────────────────────────
					if (operation === 'search') {
						const searchBodyRaw = this.getNodeParameter('searchBody', i);
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const opts = this.getNodeParameter('searchOptions', i) as {
							archived?: boolean;
							errorWhenNotFound?: boolean;
							properties?: string;
							propertiesWithHistory?: string;
							millisecondsBetweenItems?: number;
						};

						delayMs = opts.millisecondsBetweenItems ?? 50;
						const errorWhenNotFound = opts.errorWhenNotFound !== false;

						const propertiesList = opts.properties
							? opts.properties.split(',').map((s) => s.trim()).filter(Boolean)
							: [];
						const propertiesWithHistoryList = opts.propertiesWithHistory
							? opts.propertiesWithHistory.split(',').map((s) => s.trim()).filter(Boolean)
							: [];

						const searchBodyBase: JsonObject = {
							...parseJsonParam(searchBodyRaw),
							...(opts.archived !== undefined ? { archived: opts.archived } : {}),
							...(propertiesList.length ? { properties: propertiesList } : {}),
							...(propertiesWithHistoryList.length
								? { propertiesWithHistory: propertiesWithHistoryList }
								: {}),
						};
						const searchUrl = `${HUBSPOT_BASE}${USERS_OBJECT_PATH}/search`;
						let totalFound = 0;

						if (returnAll) {
							const maxPages = Math.max(
								1,
								Math.floor(this.getNodeParameter('maxPages', i) as number),
							);
							const returnAllMode = this.getNodeParameter('returnAllMode', i) as string;
							let pageCount = 0;
							let after: string | undefined;
							const allResults: JsonObject[] = [];

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

								const results = (response.results as JsonObject[] | undefined) ?? [];
								totalFound += results.length;

								if (returnAllMode === 'eachPage') {
									returnData.push({ json: response, pairedItem: { item: i } });
								} else if (returnAllMode === 'eachResult') {
									for (const result of results) {
										returnData.push({ json: result, pairedItem: { item: i } });
									}
								} else {
									allResults.push(...results);
								}

								pageCount++;
								const paging = response.paging as JsonObject | undefined;
								after = (paging?.next as JsonObject | undefined)?.after as string | undefined;
							} while (after && pageCount < maxPages);

							if (returnAllMode === 'allInOne') {
								returnData.push({ json: { results: allResults }, pairedItem: { item: i } });
							}
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{
									method: 'POST',
									url: searchUrl,
									headers: BASE_HEADERS,
									body: JSON.stringify({ ...searchBodyBase, limit }),
								},
							)) as JsonObject;

							const results = (response.results as JsonObject[] | undefined) ?? [];
							totalFound = results.length;

							returnData.push({ json: response, pairedItem: { item: i } });
						}

						if (totalFound === 0 && errorWhenNotFound) {
							throw new NodeOperationError(
								this.getNode(),
								'No users found matching the search criteria',
								{ itemIndex: i },
							);
						}
					}

					// ── UPDATE (Users only) ────────────────────────────────────────────
					if (operation === 'update') {
						const objectId = String(this.getNodeParameter('objectId', i)).trim();
						const idProperty = String(this.getNodeParameter('idProperty', i)).trim();
						const updateInputMode = this.getNodeParameter('updateInputMode', i) as string;
						const updateOpts = this.getNodeParameter('updateOptions', i) as {
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

						const lookup = await resolveUsersLookup.call(this, idProperty, objectId, i);

						const url = buildHubSpotUrl(HUBSPOT_BASE, `${USERS_OBJECT_PATH}/${lookup.realId}`, {
							idProperty: lookup.idPropertyParam,
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
				}

				if (resource === 'properties') {
					const objectType = this.getNodeParameter('objectType', i) as string;
					const propertiesPath = `${PROPERTIES_BASE_PATH}/${objectType}`;

					// ── GET PROPERTY ──────────────────────────────────────────────────────
					if (operation === 'getProperty') {
						const propertyName = String(this.getNodeParameter('getPropertyName', i)).trim();

						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'GET',
								url: `${HUBSPOT_BASE}${propertiesPath}/${propertyName}`,
								headers: BASE_HEADERS,
							},
						)) as JsonObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── LIST PROPERTIES ─────────────────────────────────────────────────
					if (operation === 'listProperties') {
						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'GET',
								url: `${HUBSPOT_BASE}${propertiesPath}`,
								headers: BASE_HEADERS,
							},
						)) as JsonObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── LIST PROPERTY GROUPS ─────────────────────────────────────────────
					if (operation === 'listPropertyGroups') {
						const response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'GET',
								url: `${HUBSPOT_BASE}${propertiesPath}/groups`,
								headers: BASE_HEADERS,
							},
						)) as JsonObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					}

					// ── UPDATE PROPERTY LABEL ────────────────────────────────────────────
					if (operation === 'updatePropertyLabel') {
						const propertyName = String(this.getNodeParameter('propertyName', i)).trim();
						const label = this.getNodeParameter('label', i) as string;
						const fields = this.getNodeParameter('updatePropertyLabelFields', i) as {
							description?: string;
						};

						const body: JsonObject = { label };
						if (fields.description !== undefined) {
							body.description = fields.description;
						}

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'PATCH',
								url: `${HUBSPOT_BASE}${propertiesPath}/${propertyName}`,
								headers: BASE_HEADERS,
								body: JSON.stringify(body),
							},
						);

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── UPDATE DROPDOWN OPTIONS ───────────────────────────────────────────
					if (operation === 'updateDropdownOptions') {
						const propertyName = String(
							this.getNodeParameter('dropdownPropertyName', i),
						).trim();
						const mode = this.getNodeParameter('dropdownUpdateMode', i) as string;
						const propertyUrl = `${HUBSPOT_BASE}${propertiesPath}/${propertyName}`;

						let finalOptions: JsonObject[];

						if (mode === 'remove') {
							const valuesToRemove = new Set(
								String(this.getNodeParameter('removeOptionValues', i))
									.split(',')
									.map((value) => value.trim())
									.filter(Boolean),
							);

							const currentProperty = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'hubspotApi',
								{ method: 'GET', url: propertyUrl, headers: BASE_HEADERS },
							)) as { options?: JsonObject[] };
							const currentOptions = currentProperty.options ?? [];

							finalOptions = currentOptions.filter(
								(option) => !valuesToRemove.has(option.value as string),
							);
						} else {
							const providedBody = parseJsonParam(
								this.getNodeParameter('dropdownOptions', i),
							) as { options?: JsonObject[] };
							const providedOptions = providedBody.options ?? [];

							if (mode === 'overwrite') {
								finalOptions = providedOptions;
							} else {
								const currentProperty = (await this.helpers.httpRequestWithAuthentication.call(
									this,
									'hubspotApi',
									{ method: 'GET', url: propertyUrl, headers: BASE_HEADERS },
								)) as { options?: JsonObject[] };
								const currentOptions = currentProperty.options ?? [];
								const providedValues = new Set(providedOptions.map((option) => option.value));

								finalOptions = [
									...currentOptions.filter((option) => !providedValues.has(option.value)),
									...providedOptions,
								];
							}
						}

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'hubspotApi',
							{
								method: 'PATCH',
								url: propertyUrl,
								headers: BASE_HEADERS,
								body: JSON.stringify({ options: finalOptions }),
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

			if (delayMs > 0 && i < items.length - 1) {
				// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
				await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return [returnData];
	}
}
