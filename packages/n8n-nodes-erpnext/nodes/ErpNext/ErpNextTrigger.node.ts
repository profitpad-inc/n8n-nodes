import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import {
	describeErpNextError,
	erpNextApi,
	getDocTypes,
	latestDatetime,
	parseJsonParameter,
	resourcePath,
	selectUnseen,
	windowStartFrom,
} from './helpers';

const PAGE_SIZE = 200;

interface TriggerState {
	watermark?: string;
	emitted?: Record<string, number>;
}

async function fetchDocs(
	this: IPollFunctions,
	docType: string,
	filters: unknown[],
	orderBy: string,
	maxDocuments: number,
): Promise<IDataObject[]> {
	const rows: IDataObject[] = [];
	while (rows.length < maxDocuments) {
		const pageSize = Math.min(PAGE_SIZE, maxDocuments - rows.length);
		const response = await erpNextApi.call(this, 'GET', resourcePath(docType), {
			qs: {
				fields: JSON.stringify(['*']),
				filters: JSON.stringify(filters),
				order_by: orderBy,
				limit_start: rows.length,
				limit_page_length: pageSize,
			},
		});
		const page = (response.data as IDataObject[] | undefined) ?? [];
		rows.push(...page);
		if (page.length < pageSize) break;
	}
	return rows;
}

async function withChildTables(
	this: IPollFunctions,
	docType: string,
	docs: IDataObject[],
): Promise<IDataObject[]> {
	const full: IDataObject[] = [];
	for (const doc of docs) {
		const response = await erpNextApi.call(this, 'GET', resourcePath(docType, String(doc.name)));
		full.push((response.data as IDataObject) ?? doc);
	}
	return full;
}

export class ErpNextTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ERPNext Trigger',
		name: 'erpNextTrigger',
		icon: 'file:app-icon.svg',
		group: ['trigger'],
		version: 1,
		description: 'Polls ERPNext for new or changed documents of a DocType on a schedule',
		subtitle: '={{$parameter["docType"] + " – " + $parameter["triggerOn"]}}',
		defaults: {
			name: 'ERPNext Trigger',
		},
		polling: true,
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'erpNextTokenApi',
				required: true,
			},
		],
		properties: [
			// Trigger On is deliberately the first property: n8n's node-insertion
			// "actions" panel reads only the first property named Trigger On /
			// Event / Events (see the HubSpot package's HANDOFF.md).
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				options: [
					{
						name: 'New Documents',
						value: 'new',
						description: 'Trigger only when documents are created',
					},
					{
						name: 'New or Updated Documents',
						value: 'newOrUpdated',
						description: 'Trigger when documents are created or saved',
					},
					{
						name: 'Updated Documents',
						value: 'updated',
						description: 'Trigger only when existing documents are saved again',
					},
				],
				default: 'newOrUpdated',
				description: 'Which kind of change should fire the trigger',
			},
			{
				displayName: 'DocType Name or ID',
				name: 'docType',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDocTypes' },
				required: true,
				default: '',
				description:
					'The ERPNext DocType to watch, e.g. Customer. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Filters (JSON)',
				name: 'filters',
				type: 'json',
				default: '[]',
				description:
					'Frappe filters a document must match, e.g. [["customer_type", "!=", "Individual"]]',
			},
			{
				displayName: 'Include Child Tables',
				name: 'includeChildTables',
				type: 'boolean',
				default: false,
				description:
					'Whether to re-read each document so child tables (e.g. email_ids, links) are included. Costs one extra request per document.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Ignore Changes By Users',
						name: 'ignoreUsers',
						type: 'string',
						default: '',
						placeholder: 'sync@example.com, Administrator',
						description:
							'Comma-separated users whose saves should not fire the trigger (matched on modified_by)',
					},
					{
						displayName: 'Lookback Seconds',
						name: 'lookbackSeconds',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 60,
						description:
							'How far each poll re-checks before the last change it saw, so a save that committed late is not missed. Already-emitted changes are never emitted twice.',
					},
					{
						displayName: 'Max Documents Per Poll',
						name: 'maxDocuments',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 500,
						description:
							'Upper bound per poll. Any remainder is picked up on the next poll, oldest first.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getDocTypes,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const triggerOn = this.getNodeParameter('triggerOn') as string;
		const docType = (this.getNodeParameter('docType') as string).trim();
		const includeChildTables = this.getNodeParameter('includeChildTables') as boolean;
		const options = this.getNodeParameter('options', {}) as {
			ignoreUsers?: string;
			lookbackSeconds?: number;
			maxDocuments?: number;
		};
		const baseFilters = parseJsonParameter<unknown[]>(
			this.getNode(),
			this.getNodeParameter('filters'),
			'Filters (JSON)',
			[],
		);
		if (!Array.isArray(baseFilters)) {
			throw new NodeOperationError(this.getNode(), 'Filters (JSON) must be a JSON array');
		}
		const lookbackSeconds = options.lookbackSeconds ?? 60;
		const maxDocuments = Math.max(1, Math.floor(options.maxDocuments ?? 500));
		const ignoreUsers = new Set(
			String(options.ignoreUsers ?? '')
				.split(',')
				.map((user) => user.trim())
				.filter(Boolean),
		);
		const timeField = triggerOn === 'new' ? 'creation' : 'modified';

		try {
			// Manual "fetch test event": no time window, just the latest matching
			// documents. Running a workflow by hand this way is also the backfill.
			if (this.getMode() === 'manual') {
				let docs = await fetchDocs.call(
					this,
					docType,
					baseFilters,
					`${timeField} desc`,
					maxDocuments,
				);
				if (includeChildTables) docs = await withChildTables.call(this, docType, docs);
				return docs.length === 0 ? null : [docs.map((doc) => ({ json: doc }))];
			}

			const state = this.getWorkflowStaticData('node') as TriggerState;

			// First activation: start from the newest existing change instead of
			// replaying history, so activating a workflow never floods it.
			if (!state.watermark) {
				const latest = await fetchDocs.call(this, docType, baseFilters, `${timeField} desc`, 1);
				state.watermark = latest[0]?.[timeField]
					? String(latest[0][timeField])
					: '1970-01-01 00:00:00';
				state.emitted = {};
				return null;
			}

			const windowStart = windowStartFrom(state.watermark, lookbackSeconds);
			const filters: unknown[] = [...baseFilters, [timeField, '>=', windowStart]];
			if (triggerOn === 'updated') filters.push(['creation', '<', windowStart]);

			const rows = await fetchDocs.call(this, docType, filters, `${timeField} asc`, maxDocuments);
			state.emitted = state.emitted ?? {};
			let docs = selectUnseen(rows, state.emitted, windowStart, timeField).filter(
				(doc) => !ignoreUsers.has(String(doc.modified_by ?? '')),
			);
			state.watermark = latestDatetime(rows, timeField, state.watermark);

			if (docs.length === 0) return null;
			if (includeChildTables) docs = await withChildTables.call(this, docType, docs);
			return [docs.map((doc) => ({ json: doc }))];
		} catch (error) {
			// Already a proper n8n error (bad filters): keep it as is.
			// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
			if (error instanceof NodeOperationError) throw error;
			const message = describeErpNextError(error as never);
			throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message } : {});
		}
	}
}
