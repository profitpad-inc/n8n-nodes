import { INodeProperties } from 'n8n-workflow';

export const scorecardDescription: INodeProperties[] = [
	// ── Operation ─────────────────────────────────────────────────────────────
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['scorecard'],
			},
		},
		options: [
			{
				name: 'Clear Score',
				value: 'deleteScore',
				description: 'Clear the score of a Measurable for one period',
				action: 'Clear a measurable score',
			},
			{
				name: 'Create or Update Score',
				value: 'upsertScore',
				description:
					'Set the score of a Measurable for one period, overwriting any existing score for that period',
				action: 'Create or update a measurable score',
			},
			{
				name: 'Get Team Scorecard',
				value: 'getTeamScorecard',
				description: "Read a Team's Scorecard: its Measurables and their scores for a window of periods",
				action: 'Get a team scorecard',
			},
		],
		default: 'getTeamScorecard',
	},

	// ── GET TEAM SCORECARD ────────────────────────────────────────────────────
	{
		displayName: 'Team Name or ID',
		name: 'teamId',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getTeams',
		},
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['getTeamScorecard'],
			},
		},
		default: '',
		description:
			'The Team whose Scorecard to read. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Period Interval',
		name: 'periodInterval',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['getTeamScorecard'],
			},
		},
		options: [
			{ name: 'Annual', value: 'annual' },
			{ name: 'Monthly', value: 'monthly' },
			{ name: 'Quarterly', value: 'quarterly' },
			{ name: 'Weekly', value: 'weekly' },
		],
		default: 'weekly',
		description: 'Which of the Team\'s Scorecards to read. Every Team has one Scorecard per interval.',
	},
	{
		displayName: 'Output',
		name: 'outputMode',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['getTeamScorecard'],
			},
		},
		options: [
			{
				name: 'Scorecard (One Item)',
				value: 'scorecard',
				description: 'Return the Scorecard exactly as Ninety returns it, as a single item',
			},
			{
				name: 'One Item per Measurable',
				value: 'kpis',
				description:
					'Return one item per Measurable, with its group and scores array (one entry per period)',
			},
			{
				name: 'One Item per Score',
				value: 'scores',
				description:
					'Return one item per Measurable per period, flattened with the Measurable and group details',
			},
		],
		default: 'scorecard',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['getTeamScorecard'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Date',
				name: 'date',
				type: 'string',
				default: '',
				placeholder: '2026-08-15',
				description:
					'Return only the single period containing this calendar date (YYYY-MM-DD). Any date inside the period works; Ninety snaps it to the period boundary using the company weekly start day and fiscal calendar. When set, Window is ignored.',
			},
			{
				displayName: 'Window',
				name: 'window',
				type: 'options',
				options: [
					{ name: 'Current Quarter', value: 'currentQuarter' },
					{ name: 'Current Year', value: 'currentYear' },
					{ name: 'Default (Most Recent 13 Periods)', value: 'default' },
					{ name: 'Quarter to Date', value: 'qtd' },
					{ name: 'Year to Date', value: 'ytd' },
				],
				default: 'default',
				description:
					'The window of periods to return. Quarterly Scorecards support only Default, Year to Date and Current Year; Annual Scorecards support only Default.',
			},
		],
	},

	// ── CREATE OR UPDATE SCORE / CLEAR SCORE ─────────────────────────────────
	// Team and Period Interval only narrow the Measurable dropdown below; they
	// are not sent with the score request. Same parameter names as the Get Team
	// Scorecard fields, so switching operations keeps the selection.
	{
		displayName: 'Team Name or ID',
		name: 'teamId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getTeams',
		},
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['upsertScore', 'deleteScore'],
			},
		},
		default: '',
		description:
			'Filters the Measurable list to this Team\'s Scorecards. Leave empty to list Measurables from every Team. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Period Interval',
		name: 'periodInterval',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['upsertScore', 'deleteScore'],
			},
		},
		options: [
			{ name: 'Annual', value: 'annual' },
			{ name: 'Monthly', value: 'monthly' },
			{ name: 'Quarterly', value: 'quarterly' },
			{ name: 'Weekly', value: 'weekly' },
		],
		default: 'weekly',
		description: 'Filters the Measurable list to Measurables with this period interval',
	},
	{
		displayName: 'Measurable Name or ID',
		name: 'kpiId',
		type: 'options',
		required: true,
		typeOptions: {
			loadOptionsMethod: 'getKpis',
			loadOptionsDependsOn: ['teamId', 'periodInterval'],
		},
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['upsertScore', 'deleteScore'],
			},
		},
		default: '',
		description:
			'The Measurable (KPI) whose score to change. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Period Start Date',
		name: 'periodStartDate',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['upsertScore', 'deleteScore'],
			},
		},
		default: '',
		description:
			'The first day of the period (for example the 1st of the month for a monthly Measurable). The picked date is sent as midnight UTC, e.g. 2026-08-01T00:00:00.000Z; any time of day is ignored. An expression can also supply a full ISO 8601 datetime, such as a periodStartDate returned by Get Team Scorecard.',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'number',
		required: true,
		typeOptions: {
			numberPrecision: 10,
		},
		displayOptions: {
			show: {
				resource: ['scorecard'],
				operation: ['upsertScore'],
			},
		},
		default: 0,
		description: 'The score value to record for the period',
	},
];
