import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { documentDescription } from './descriptions/DocumentDescription';
import { methodDescription } from './descriptions/MethodDescription';
import {
	FieldChange,
	describeErpNextError,
	diffFields,
	erpNextApi,
	fieldValuesToObject,
	getDocTypeFields,
	getDocTypes,
	getErrorStatus,
	parseJsonParameter,
	resourcePath,
} from './helpers';

// Programmatic rather than declarative: Upsert and "Skip If Unchanged" need
// several dependent calls per item (find, read, compare, then maybe write),
// and ERPNext's error bodies need unpacking to be readable.

const GET_MANY_PAGE_SIZE = 500;

interface WriteResult extends IDataObject {
	action: 'created' | 'updated' | 'unchanged' | 'notFound';
	changed: boolean;
	doctype: string;
	name: string | null;
	changes: FieldChange[];
	doc: IDataObject | null;
}

function isNotFound(error: unknown): boolean {
	return getErrorStatus(error as never) === 404;
}

async function getDocument(
	this: IExecuteFunctions,
	docType: string,
	name: string,
): Promise<IDataObject> {
	const response = await erpNextApi.call(this, 'GET', resourcePath(docType, name));
	return (response.data as IDataObject) ?? {};
}

/** Name of the one document whose `field` equals `value`, or undefined. */
async function findName(
	this: IExecuteFunctions,
	docType: string,
	field: string,
	value: string,
	itemIndex: number,
): Promise<string | undefined> {
	if (!field || value === '') return undefined;
	if (field === 'name') {
		try {
			const doc = await getDocument.call(this, docType, value);
			return doc.name === undefined ? undefined : String(doc.name);
		} catch (error) {
			if (isNotFound(error)) return undefined;
			// Passed up unchanged; execute() wraps it with the item index.
			// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
			throw error;
		}
	}
	const response = await erpNextApi.call(this, 'GET', resourcePath(docType), {
		qs: {
			filters: JSON.stringify([[field, '=', value]]),
			fields: JSON.stringify(['name']),
			limit_page_length: 2,
		},
	});
	const rows = (response.data as IDataObject[] | undefined) ?? [];
	if (rows.length > 1) {
		throw new NodeOperationError(
			this.getNode(),
			`More than one ${docType} has ${field} = "${value}", so the match is ambiguous`,
			{ itemIndex },
		);
	}
	return rows[0]?.name === undefined ? undefined : String(rows[0].name);
}

async function writeExisting(
	this: IExecuteFunctions,
	docType: string,
	name: string,
	fields: IDataObject,
	skipIfUnchanged: boolean,
): Promise<WriteResult> {
	const current = await getDocument.call(this, docType, name);
	const changes = diffFields(fields, current);
	if (skipIfUnchanged && changes.length === 0) {
		return { action: 'unchanged', changed: false, doctype: docType, name, changes, doc: current };
	}
	const response = await erpNextApi.call(this, 'PUT', resourcePath(docType, name), {
		body: fields,
	});
	return {
		action: 'updated',
		changed: true,
		doctype: docType,
		name,
		changes,
		doc: (response.data as IDataObject) ?? null,
	};
}

function readFields(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const inputMode = this.getNodeParameter('inputMode', itemIndex) as string;
	if (inputMode === 'json') {
		const fields = parseJsonParameter<IDataObject>(
			this.getNode(),
			this.getNodeParameter('fieldsJson', itemIndex),
			'Fields (JSON)',
			{},
			itemIndex,
		);
		if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
			throw new NodeOperationError(this.getNode(), 'Fields (JSON) must be a JSON object', {
				itemIndex,
			});
		}
		return fields;
	}
	const ui = this.getNodeParameter('fieldsUi', itemIndex, {}) as {
		fieldValues?: Array<{ name?: string; value?: unknown }>;
	};
	return fieldValuesToObject(ui.fieldValues ?? []);
}

export class ErpNext implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ERPNext',
		name: 'erpNext',
		icon: 'file:app-icon.svg',
		group: ['transform'],
		version: 1,
		subtitle:
			'={{$parameter["resource"] === "method" ? ("call: " + $parameter["methodPath"]) : ($parameter["operation"] + ": " + ($parameter["docType"] || ""))}}',
		description:
			'Read and write ERPNext documents and call whitelisted methods. Docs: https://docs.frappe.io/framework/user/en/api/rest',
		usableAsTool: true,
		defaults: {
			name: 'ERPNext',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'erpNextTokenApi',
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
						name: 'Document',
						value: 'document',
						description: 'Work with documents of any DocType, e.g. Customer or Contact',
					},
					{
						name: 'Method',
						value: 'method',
						description: 'Call a whitelisted ERPNext server method',
					},
				],
				default: 'document',
			},
			...documentDescription,
			...methodDescription,
		],
	};

	methods = {
		loadOptions: {
			getDocTypes,
			getDocTypeFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'method') {
					const methodPath = (this.getNodeParameter('methodPath', i) as string).trim();
					const httpMethod = this.getNodeParameter('httpMethod', i) as 'GET' | 'POST';
					const parameters = parseJsonParameter<IDataObject>(
						this.getNode(),
						this.getNodeParameter('methodParameters', i),
						'Parameters (JSON)',
						{},
						i,
					);
					const path = `/api/method/${methodPath}`;
					const response =
						httpMethod === 'GET'
							? await erpNextApi.call(this, 'GET', path, {
									qs: Object.fromEntries(
										Object.entries(parameters).map(([key, value]) => [
											key,
											typeof value === 'object' ? JSON.stringify(value) : value,
										]),
									) as IDataObject,
								})
							: await erpNextApi.call(this, 'POST', path, { body: parameters });
					returnData.push({ json: response, pairedItem: { item: i } });
					continue;
				}

				const docType = (this.getNodeParameter('docType', i) as string).trim();

				if (operation === 'get') {
					const name = this.getNodeParameter('documentName', i) as string;
					const options = this.getNodeParameter('getOptions', i, {}) as {
						errorWhenNotFound?: boolean;
					};
					try {
						const doc = await getDocument.call(this, docType, name);
						returnData.push({ json: doc, pairedItem: { item: i } });
					} catch (error) {
						if (options.errorWhenNotFound === false && isNotFound(error)) {
							returnData.push({
								json: { found: false, doctype: docType, name },
								pairedItem: { item: i },
							});
						} else {
							// Caught just below and wrapped as a NodeApiError.
							// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
							throw error;
						}
					}
					continue;
				}

				if (operation === 'getMany') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					const filters = parseJsonParameter<unknown[]>(
						this.getNode(),
						this.getNodeParameter('filters', i),
						'Filters (JSON)',
						[],
						i,
					);
					const options = this.getNodeParameter('getManyOptions', i, {}) as {
						orFilters?: string;
						orderBy?: string;
					};
					const orFilters = parseJsonParameter<unknown[]>(
						this.getNode(),
						options.orFilters,
						'Or Filters (JSON)',
						[],
						i,
					);
					const rawFields = (this.getNodeParameter('returnFields', i) as string).trim();
					const fields =
						rawFields === '' || rawFields === '*'
							? ['*']
							: rawFields
									.split(',')
									.map((field) => field.trim())
									.filter(Boolean);

					let start = 0;
					let collected = 0;
					for (;;) {
						const pageSize = Math.min(GET_MANY_PAGE_SIZE, limit - collected);
						const qs: IDataObject = {
							fields: JSON.stringify(fields),
							filters: JSON.stringify(filters),
							order_by: options.orderBy || 'modified desc',
							limit_start: start,
							limit_page_length: pageSize,
						};
						if (orFilters.length > 0) qs.or_filters = JSON.stringify(orFilters);
						const response = await erpNextApi.call(this, 'GET', resourcePath(docType), { qs });
						const rows = (response.data as IDataObject[] | undefined) ?? [];
						for (const row of rows) returnData.push({ json: row, pairedItem: { item: i } });
						collected += rows.length;
						start += rows.length;
						if (rows.length < pageSize || collected >= limit) break;
					}
					continue;
				}

				if (operation === 'create') {
					const fields = readFields.call(this, i);
					const response = await erpNextApi.call(this, 'POST', resourcePath(docType), {
						body: fields,
					});
					returnData.push({
						json: (response.data as IDataObject) ?? {},
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'delete') {
					const name = this.getNodeParameter('documentName', i) as string;
					await erpNextApi.call(this, 'DELETE', resourcePath(docType, name));
					returnData.push({
						json: { deleted: true, doctype: docType, name },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'update' || operation === 'upsert') {
					const fields = readFields.call(this, i);
					const options = this.getNodeParameter('writeOptions', i, {}) as {
						skipIfUnchanged?: boolean;
						createIfNotFound?: boolean;
						fallbackMatchField?: string;
						fallbackMatchValue?: string;
					};
					const skipIfUnchanged = options.skipIfUnchanged !== false;

					if (operation === 'update') {
						const name = this.getNodeParameter('documentName', i) as string;
						const result = await writeExisting.call(this, docType, name, fields, skipIfUnchanged);
						returnData.push({ json: result, pairedItem: { item: i } });
						continue;
					}

					const matchField = (this.getNodeParameter('matchField', i) as string).trim();
					const matchValue = String(this.getNodeParameter('matchValue', i) ?? '').trim();
					const fallbackField = (options.fallbackMatchField ?? '').trim();
					const fallbackValue = String(options.fallbackMatchValue ?? '').trim();

					const name =
						(await findName.call(this, docType, matchField, matchValue, i)) ??
						(await findName.call(this, docType, fallbackField, fallbackValue, i));

					let result: WriteResult;
					if (name !== undefined) {
						result = await writeExisting.call(this, docType, name, fields, skipIfUnchanged);
					} else if (options.createIfNotFound === false) {
						result = {
							action: 'notFound',
							changed: false,
							doctype: docType,
							name: null,
							changes: [],
							doc: null,
						};
					} else {
						// Stamp the match value on the new document, so the next upsert
						// finds it by the same field instead of creating a duplicate.
						const body: IDataObject = { ...fields };
						if (matchField !== 'name' && matchValue !== '' && body[matchField] === undefined) {
							body[matchField] = matchValue;
						}
						const response = await erpNextApi.call(this, 'POST', resourcePath(docType), {
							body,
						});
						const doc = (response.data as IDataObject) ?? {};
						result = {
							action: 'created',
							changed: true,
							doctype: docType,
							name: doc.name === undefined ? null : String(doc.name),
							changes: diffFields(body, {}),
							doc,
						};
					}
					returnData.push({ json: result, pairedItem: { item: i } });
					continue;
				}

				throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, {
					itemIndex: i,
				});
			} catch (error) {
				const message = describeErpNextError(error as never);
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: message ?? (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Already a proper n8n error (bad input, ambiguous match): keep it as is.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as JsonObject, {
					itemIndex: i,
					...(message ? { message } : {}),
				});
			}
		}

		return [returnData];
	}
}
