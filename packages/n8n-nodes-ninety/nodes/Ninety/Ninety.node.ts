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

import { scorecardDescription } from './descriptions/ScorecardDescription';
import {
	BASE_HEADERS,
	getKpis,
	getTeams,
	ninetyRequest,
	ninetyUrl,
	normalizePeriodStartDate,
	TeamScorecardResponse,
} from './helpers';

const SCORECARD_BASE_PATH = '/scorecard';

/**
 * Encodes a period start date for use as a path segment, leaving `:` as-is
 * (valid in a path segment per RFC 3986) so the URL matches the form
 * `/scores/2026-08-01T00:00:00.000Z` that is known to work against the API.
 */
function encodePeriodPathSegment(periodStartDate: string): string {
	return encodeURIComponent(periodStartDate).replace(/%3A/gi, ':');
}

/**
 * Splits a Team Scorecard response into n8n items according to Output.
 * `scorecard` keeps the response whole; `kpis` emits one item per Measurable;
 * `scores` emits one item per Measurable per period.
 */
function splitScorecard(scorecard: TeamScorecardResponse, outputMode: string): IDataObject[] {
	if (outputMode === 'scorecard') return [scorecard];

	const scorecardInfo = {
		scorecardId: scorecard.id,
		scorecardName: scorecard.name,
		periodInterval: scorecard.periodInterval,
		teamId: scorecard.teamId,
	};

	const rows: IDataObject[] = [];
	for (const group of scorecard.groups ?? []) {
		for (const kpi of group.kpis ?? []) {
			const scores = kpi.scores;
			// id and title are re-emitted as kpiId / kpiTitle below.
			const kpiFields: IDataObject = { ...kpi };
			delete kpiFields.scores;
			delete kpiFields.id;
			delete kpiFields.title;
			const kpiInfo = {
				...scorecardInfo,
				groupId: group.id,
				groupName: group.name,
				kpiId: kpi.id,
				kpiTitle: kpi.title,
			};

			if (outputMode === 'kpis') {
				rows.push({ ...kpiInfo, ...kpiFields, scores: scores ?? [] });
				continue;
			}

			for (const score of scores ?? []) {
				rows.push({
					...kpiInfo,
					unit: kpi.unit,
					currency: kpi.currency,
					ownerName: kpi.ownerName,
					defaultGoal: kpi.defaultGoal,
					...score,
				});
			}
		}
	}
	return rows;
}

export class Ninety implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ninety',
		name: 'ninety',
		icon: 'file:ninety.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Ninety public API. Docs: https://api.public.ninety.io/v1/swagger',
		usableAsTool: true,
		defaults: {
			name: 'Ninety',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'ninetyApi',
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
						name: 'Scorecard',
						value: 'scorecard',
						description: 'Read Team Scorecards and write Measurable scores',
					},
				],
				default: 'scorecard',
			},
			...scorecardDescription,
		],
	};

	methods = {
		loadOptions: {
			getKpis,
			getTeams,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'scorecard') {
					// ── GET TEAM SCORECARD ──────────────────────────────────────────────
					if (operation === 'getTeamScorecard') {
						const teamId = String(this.getNodeParameter('teamId', i)).trim();
						const periodInterval = this.getNodeParameter('periodInterval', i) as string;
						const outputMode = this.getNodeParameter('outputMode', i, 'scorecard') as string;
						const additionalOptions = this.getNodeParameter(
							'additionalOptions',
							i,
							{},
						) as IDataObject;

						if (!teamId) {
							throw new NodeOperationError(this.getNode(), 'Team is required', { itemIndex: i });
						}

						const qs: IDataObject = { teamId, periodInterval };
						const date = String(additionalOptions.date ?? '').trim();
						// `date` and `window` are mutually exclusive in the API.
						if (date) {
							qs.date = date;
						} else if (additionalOptions.window) {
							qs.window = additionalOptions.window;
						}

						const scorecard = (await ninetyRequest.call(this, {
							method: 'GET',
							url: ninetyUrl(`${SCORECARD_BASE_PATH}/team-scorecard`),
							headers: BASE_HEADERS,
							qs,
						})) as TeamScorecardResponse;

						for (const row of splitScorecard(scorecard, outputMode)) {
							returnData.push({ json: row, pairedItem: { item: i } });
						}
					}

					// ── CREATE OR UPDATE SCORE ──────────────────────────────────────────
					else if (operation === 'upsertScore') {
						const kpiId = String(this.getNodeParameter('kpiId', i)).trim();
						const periodStartDate = normalizePeriodStartDate(
							this.getNodeParameter('periodStartDate', i),
						);
						const value = this.getNodeParameter('value', i) as number;

						if (!kpiId || !periodStartDate) {
							throw new NodeOperationError(
								this.getNode(),
								'Measurable and Period Start Date are required',
								{ itemIndex: i },
							);
						}
						if (typeof value !== 'number' || !Number.isFinite(value)) {
							throw new NodeOperationError(this.getNode(), 'Value must be a number', {
								itemIndex: i,
							});
						}

						const response = await ninetyRequest.call(this, {
							method: 'POST',
							url: ninetyUrl(
								`${SCORECARD_BASE_PATH}/kpis/${encodeURIComponent(kpiId)}/scores`,
							),
							headers: BASE_HEADERS,
							body: JSON.stringify({ value, periodStartDate }),
						});

						returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
					}

					// ── CLEAR SCORE ─────────────────────────────────────────────────────
					else if (operation === 'deleteScore') {
						const kpiId = String(this.getNodeParameter('kpiId', i)).trim();
						const periodStartDate = normalizePeriodStartDate(
							this.getNodeParameter('periodStartDate', i),
						);

						if (!kpiId || !periodStartDate) {
							throw new NodeOperationError(
								this.getNode(),
								'Measurable and Period Start Date are required',
								{ itemIndex: i },
							);
						}

						await ninetyRequest.call(this, {
							method: 'DELETE',
							url: ninetyUrl(
								`${SCORECARD_BASE_PATH}/kpis/${encodeURIComponent(kpiId)}/scores/${encodePeriodPathSegment(periodStartDate)}`,
							),
							headers: BASE_HEADERS,
						});

						returnData.push({
							json: { deleted: true, kpiId, periodStartDate },
							pairedItem: { item: i },
						});
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`Unsupported operation "${operation}" for resource "${resource}"`,
							{ itemIndex: i },
						);
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource "${resource}"`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Input validation errors are already NodeOperationErrors with an item index.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
