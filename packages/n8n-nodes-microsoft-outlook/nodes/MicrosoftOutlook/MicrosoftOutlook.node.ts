import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { messageFields, messageOperations } from './descriptions/MessageDescription';
import {
	GRAPH_BASE_URL,
	MAILBOX_FOLDER_PATHS,
	fetchAllGraphResults,
	microsoftGraphApiRequest,
	paginatedGraphRequest,
} from './GenericFunctions';

export class MicrosoftOutlook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Microsoft Outlook',
		name: 'microsoftOutlook',
		icon: 'file:microsoftOutlookIcon.svg',
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
				} else if (resource === 'message' && operation === 'getMessage') {
					const results = await getMessage.call(this, i);
					returnData.push(...results);
				} else if (resource === 'message' && operation === 'sendMail') {
					const results = await sendMail.call(this, i);
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

	const pages = await paginatedGraphRequest.call(
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

async function getMessage(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const mailboxAddress = this.getNodeParameter('mailboxAddress', itemIndex) as string;
	const messageId = this.getNodeParameter('messageId', itemIndex) as string;
	const select = this.getNodeParameter('select', itemIndex, []) as string[];
	const includeAttachments = this.getNodeParameter('includeAttachments', itemIndex, 'none') as
		| 'none'
		| 'json'
		| 'file'
		| 'both';

	const messageUrl = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailboxAddress)}/messages/${encodeURIComponent(
		messageId,
	)}`;

	const qs: IDataObject = {};
	if (select.length) qs.$select = select.join(',');

	const message = await microsoftGraphApiRequest.call(this, 'GET', messageUrl, qs, itemIndex);
	const executionData: INodeExecutionData = { json: message, pairedItem: { item: itemIndex } };

	if (includeAttachments !== 'none') {
		const attachments = await fetchAllGraphResults.call(this, `${messageUrl}/attachments`, itemIndex);

		if (includeAttachments === 'file' || includeAttachments === 'both') {
			executionData.binary = await attachmentsToBinary.call(this, attachments);
		}

		// contentBytes is redundant once a binary copy exists (Include As File / Include
		// In Both) — keep the full attachment objects, just without that duplicated payload.
		message.attachments =
			includeAttachments === 'json' ? attachments : attachments.map(stripContentBytes);
	}

	return [executionData];
}

function stripContentBytes(attachment: IDataObject): IDataObject {
	const stripped = { ...attachment };
	delete stripped.contentBytes;
	return stripped;
}

/**
 * Converts every Graph fileAttachment with content into n8n binary data. Item
 * and reference attachments (no `contentBytes`) are skipped — there's no file
 * content to attach for those.
 */
async function attachmentsToBinary(
	this: IExecuteFunctions,
	attachments: IDataObject[],
): Promise<IBinaryKeyData> {
	const binary: IBinaryKeyData = {};
	let fileCount = 0;

	for (const attachment of attachments) {
		const odataType = String(attachment['@odata.type'] ?? '').toLowerCase();
		const contentBytes = attachment.contentBytes as string | undefined;

		if (!odataType.includes('fileattachment') || !contentBytes) {
			continue;
		}

		binary[`attachment_${fileCount}`] = await this.helpers.prepareBinaryData(
			Buffer.from(contentBytes, 'base64'),
			attachment.name as string | undefined,
			(attachment.contentType as string | undefined) ?? undefined,
		);
		fileCount += 1;
	}

	return binary;
}

async function sendMail(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const mailboxAddress = this.getNodeParameter('mailboxAddress', itemIndex) as string;
	const subject = this.getNodeParameter('subject', itemIndex, '') as string;
	const htmlBody = this.getNodeParameter('htmlBody', itemIndex, '') as string;
	const additionalOptions = this.getNodeParameter('sendMailAdditionalOptions', itemIndex, {}) as IDataObject;
	const saveToSentItems = (additionalOptions.saveToSentItems as boolean) ?? true;
	const recipientsMode = this.getNodeParameter('recipientsMode', itemIndex, 'fields') as 'fields' | 'json';

	const toRecipients = resolveRecipients.call(this, itemIndex, 'to', recipientsMode);
	if (toRecipients.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one "To" recipient is required', {
			itemIndex,
		});
	}
	const ccRecipients = resolveRecipients.call(this, itemIndex, 'cc', recipientsMode);
	const bccRecipients = resolveRecipients.call(this, itemIndex, 'bcc', recipientsMode);
	const attachments = await resolveAttachments.call(this, itemIndex);

	const message: IDataObject = {
		subject,
		body: { contentType: 'HTML', content: htmlBody },
		toRecipients,
	};
	if (ccRecipients.length) message.ccRecipients = ccRecipients;
	if (bccRecipients.length) message.bccRecipients = bccRecipients;
	if (attachments.length) message.attachments = attachments;

	const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(mailboxAddress)}/sendMail`;
	await microsoftGraphApiRequest.call(this, 'POST', url, {}, itemIndex, { message, saveToSentItems });

	return [{ json: { success: true }, pairedItem: { item: itemIndex } }];
}

interface RecipientEntry {
	email?: string;
	name?: string;
}

/**
 * Reads the To/CC/BCC "Fields"/"JSON" pair for `prefix` (per the single
 * shared `recipientsMode` field, not a per-recipient-type one) and resolves
 * it into Graph's `[{ emailAddress: { address, name? } }]` recipient shape.
 * Entries with no email are silently dropped in both modes.
 */
function resolveRecipients(
	this: IExecuteFunctions,
	itemIndex: number,
	prefix: 'to' | 'cc' | 'bcc',
	mode: 'fields' | 'json',
): IDataObject[] {
	let entries: RecipientEntry[];

	if (mode === 'json') {
		const raw = this.getNodeParameter(`${prefix}Json`, itemIndex, '[]');
		let parsed: unknown;
		try {
			parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
		} catch {
			throw new NodeOperationError(this.getNode(), `The ${prefix.toUpperCase()} (JSON) field is not valid JSON`, {
				itemIndex,
			});
		}
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				this.getNode(),
				`The ${prefix.toUpperCase()} (JSON) field must be an array of { email, name } objects`,
				{ itemIndex },
			);
		}
		entries = parsed as RecipientEntry[];
	} else {
		const collection = this.getNodeParameter(`${prefix}Recipients`, itemIndex, {}) as {
			recipient?: RecipientEntry[];
		};
		entries = collection.recipient ?? [];
	}

	return entries
		.filter((entry) => entry.email)
		.map((entry) => ({
			emailAddress: entry.name ? { address: entry.email, name: entry.name } : { address: entry.email },
		}));
}

/**
 * Resolves Send Mail → Attachments Input Mode into Graph `fileAttachment`
 * objects, sourcing the raw bytes differently per mode: pasted base64, a
 * JSON array of the same (for a dynamic/unknown number of attachments),
 * n8n binary data already on the input item, or a fetched URL.
 */
async function resolveAttachments(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject[]> {
	const mode = this.getNodeParameter('attachmentsMode', itemIndex, 'none') as
		| 'none'
		| 'base64'
		| 'json'
		| 'binary'
		| 'url';

	if (mode === 'none') {
		return [];
	}

	if (mode === 'base64') {
		const collection = this.getNodeParameter('attachmentsBase64', itemIndex, {}) as {
			attachment?: Array<{ name: string; contentType?: string; content: string }>;
		};
		return (collection.attachment ?? []).map((entry) =>
			buildFileAttachment(entry.name, entry.contentType, entry.content),
		);
	}

	if (mode === 'json') {
		const raw = this.getNodeParameter('attachmentsJson', itemIndex, '[]');
		let parsed: unknown;
		try {
			parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
		} catch {
			throw new NodeOperationError(this.getNode(), 'The Attachments (JSON) field is not valid JSON', {
				itemIndex,
			});
		}
		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				this.getNode(),
				'The Attachments (JSON) field must be an array of { name, contentType, contentBytes } or { name, contentType, url } objects',
				{ itemIndex },
			);
		}

		const attachments: IDataObject[] = [];
		for (const entry of parsed as Array<{
			name?: string;
			contentType?: string;
			contentBytes?: string;
			url?: string;
		}>) {
			if (entry.contentBytes) {
				if (!entry.name) {
					throw new NodeOperationError(
						this.getNode(),
						'Every Attachments (JSON) entry with "contentBytes" must also have a "name"',
						{ itemIndex },
					);
				}
				attachments.push(buildFileAttachment(entry.name, entry.contentType, entry.contentBytes));
			} else if (entry.url) {
				attachments.push(await fetchAttachmentFromUrl.call(this, entry.url, entry.name, entry.contentType));
			} else {
				throw new NodeOperationError(
					this.getNode(),
					'Every Attachments (JSON) entry must include either "contentBytes" or "url"',
					{ itemIndex },
				);
			}
		}
		return attachments;
	}

	if (mode === 'binary') {
		const rawPropertyNames = (this.getNodeParameter('attachmentsBinaryProperties', itemIndex, '') as string).trim();

		// An explicit list attaches only those properties; left blank, every binary
		// property already on the item is attached — for when the number of
		// attachments isn't known ahead of time (varies per execution).
		const propertyNames = rawPropertyNames
			? rawPropertyNames
					.split(',')
					.map((name) => name.trim())
					.filter((name) => name.length > 0)
			: Object.keys(this.getInputData()[itemIndex]?.binary ?? {});

		const attachments: IDataObject[] = [];
		for (const propertyName of propertyNames) {
			const binaryData = this.helpers.assertBinaryData(itemIndex, propertyName);
			const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propertyName);
			attachments.push(
				buildFileAttachment(binaryData.fileName ?? propertyName, binaryData.mimeType, buffer.toString('base64')),
			);
		}
		return attachments;
	}

	// url
	const collection = this.getNodeParameter('attachmentsUrls', itemIndex, {}) as {
		attachment?: Array<{ url: string; name?: string; contentType?: string }>;
	};

	const attachments: IDataObject[] = [];
	for (const entry of collection.attachment ?? []) {
		attachments.push(await fetchAttachmentFromUrl.call(this, entry.url, entry.name, entry.contentType));
	}
	return attachments;
}

/**
 * Fetches `url` and returns it as a Graph `fileAttachment`. Shared by
 * Attachments Input Mode "URLs" and any `{ url: ... }` entry in "JSON" mode.
 * Uses a plain, unauthenticated request — these are arbitrary user-supplied
 * URLs, unrelated to the Microsoft Outlook credential.
 */
async function fetchAttachmentFromUrl(
	this: IExecuteFunctions,
	url: string,
	name: string | undefined,
	contentType: string | undefined,
): Promise<IDataObject> {
	const response = (await this.helpers.httpRequest({
		method: 'GET',
		url,
		encoding: 'arraybuffer',
		returnFullResponse: true,
	})) as { body: ArrayBuffer | Buffer; headers: IDataObject };

	const buffer = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
	const resolvedContentType = contentType || (response.headers['content-type'] as string | undefined);

	return buildFileAttachment(name || urlFileName(url), resolvedContentType, buffer.toString('base64'));
}

function buildFileAttachment(name: string, contentType: string | undefined, contentBytes: string): IDataObject {
	return {
		'@odata.type': '#microsoft.graph.fileAttachment',
		name,
		...(contentType ? { contentType } : {}),
		contentBytes,
	};
}

function urlFileName(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		return pathname.substring(pathname.lastIndexOf('/') + 1) || 'attachment';
	} catch {
		return 'attachment';
	}
}
