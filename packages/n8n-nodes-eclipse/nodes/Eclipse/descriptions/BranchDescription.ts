import { INodeProperties } from 'n8n-workflow';

// Maps the Get Audit Logs option names to the query param names Eclipse expects.
export const branchAuditLogQueryParams: Record<string, string> = {
  branchId: 'ID',
  lastUpdatedDateTime: 'LastUpdatedDateTime',
  lastUpdatedDate: 'LastUpdatedDate',
  lastUpdatedTime: 'LastUpdatedTime',
  action: 'Action',
  user: 'User',
  sortBy: 'sortBy',
  sortOrder: 'sortOrder',
};

const returnAllModeOptions = [
  {
    name: 'All Results as 1 Item',
    value: 'allInOne',
    description: 'Aggregate all pages and return every result combined in a single output item, with an array of each page\'s metadata',
  },
  {
    name: 'Each Page as 1 Item',
    value: 'eachPage',
    description: 'Return each API page response as a separate output item',
  },
  {
    name: 'Each Result as 1 Item',
    value: 'eachResult',
    description: 'Return each individual record as a separate output item, with no metadata',
  },
];

export const branchDescription: INodeProperties[] = [
  // ── Branch operations ─────────────────────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['branch'],
      },
    },
    options: [
      {
        name: 'Get Audit Logs',
        value: 'getAuditLogs',
        description: 'Retrieve the most recent changes made to branch records',
        action: 'Get branch audit logs',
      },
      {
        name: 'Get Many',
        value: 'getMany',
        description: 'Search for branches',
        action: 'Get many branches',
      },
    ],
    default: 'getMany',
  },

  // ── Get Many ──────────────────────────────────────────────────────────
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Return All Mode',
    name: 'returnAllMode',
    type: 'options',
    noDataExpression: true,
    default: 'eachPage',
    description: 'How to output the fetched results',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
        returnAll: [true],
      },
    },
    options: returnAllModeOptions,
  },
  {
    displayName: 'Page Size',
    name: 'pageSize',
    type: 'number',
    typeOptions: { minValue: 1 },
    default: 10,
    description: 'Number of branches to return per page',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Fields to Return',
    name: 'fieldsFilterMode',
    type: 'options',
    options: [
      {
        name: 'All Fields',
        value: 'all',
        description: 'Return all fields from each result',
      },
      {
        name: 'All Fields Except',
        value: 'except',
        description: 'Return all fields except the specified ones from each result',
      },
      {
        name: 'Selected Fields',
        value: 'selected',
        description: 'Return only the specified fields from each result. Supports dot notation.',
      },
    ],
    default: 'all',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Fields to Include',
    name: 'fieldsToInclude',
    type: 'string',
    default: '',
    placeholder: 'id,name',
    description: 'Comma-separated list of fields to include in each result. Supports dot notation for nested fields.',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
        fieldsFilterMode: ['selected'],
      },
    },
  },
  {
    displayName: 'Fields to Exclude',
    name: 'fieldsToExclude',
    type: 'string',
    default: '',
    placeholder: 'updateKey',
    description: 'Comma-separated list of fields to exclude from each result',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
        fieldsFilterMode: ['except'],
      },
    },
  },
  {
    displayName: 'Additional Options',
    name: 'additionalOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getMany'],
      },
    },
    options: [
      {
        displayName: 'ID',
        name: 'id',
        type: 'string',
        default: '',
        placeholder: '1 or 1,2,3',
        description: 'Filter by branch ID. Separate multiple IDs with commas.',
      },
      {
        displayName: 'Keyword',
        name: 'keyword',
        type: 'string',
        default: '',
        description: 'Filter branches by keyword search',
      },
      {
        displayName: 'Start Index',
        name: 'startIndex',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 1,
        description: 'The index of the first record to return (1-based)',
      },
    ],
  },

  // ── Get Audit Logs ────────────────────────────────────────────────────
  {
    displayName: 'Return All',
    name: 'auditLogReturnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getAuditLogs'],
      },
    },
  },
  {
    displayName: 'Return All Mode',
    name: 'auditLogReturnAllMode',
    type: 'options',
    noDataExpression: true,
    default: 'eachPage',
    description: 'How to output the fetched results',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getAuditLogs'],
        auditLogReturnAll: [true],
      },
    },
    options: returnAllModeOptions,
  },
  {
    displayName: 'Page Size',
    name: 'auditLogPageSize',
    type: 'number',
    typeOptions: { minValue: 1 },
    default: 25,
    description: 'Number of audit log records to return per page',
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getAuditLogs'],
      },
    },
  },
  {
    displayName: 'Additional Options',
    name: 'auditLogOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['branch'],
        operation: ['getAuditLogs'],
      },
    },
    options: [
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        default: 'U',
        description: 'Only return changes of this type. When not added, changes of every type are returned.',
        options: [
          { name: 'Create', value: 'C' },
          { name: 'Delete', value: 'D' },
          { name: 'Update', value: 'U' },
        ],
      },
      {
        displayName: 'Branch ID',
        name: 'branchId',
        type: 'string',
        default: '',
        description: 'Only return changes made to this branch',
      },
      {
        displayName: 'Last Updated Date',
        name: 'lastUpdatedDate',
        type: 'dateTime',
        default: '',
        description: 'Only return changes made after this date (format YYYY-MM-DDTHH:MM:SSZ)',
      },
      {
        displayName: 'Last Updated Date Time',
        name: 'lastUpdatedDateTime',
        type: 'dateTime',
        default: '',
        description: 'Only return changes made after this date and time (format YYYY-MM-DDTHH:MM:SSZ)',
      },
      {
        displayName: 'Last Updated Time',
        name: 'lastUpdatedTime',
        type: 'dateTime',
        default: '',
        description: 'Only return changes made after this time (format YYYY-MM-DDTHH:MM:SSZ)',
      },
      {
        displayName: 'Sort By',
        name: 'sortBy',
        type: 'options',
        default: 'DATETIME',
        description: 'Field to sort by. Eclipse defaults to Date Time.',
        options: [
          { name: 'Date', value: 'DATE' },
          { name: 'Date Time', value: 'DATETIME' },
          { name: 'Time', value: 'TIME' },
          { name: 'Update Type', value: 'UPDATETYPE' },
          { name: 'User', value: 'USER' },
        ],
      },
      {
        displayName: 'Sort Order',
        name: 'sortOrder',
        type: 'options',
        default: 'ASC',
        description: 'Sort direction. Eclipse defaults to ascending.',
        options: [
          { name: 'Ascending', value: 'ASC' },
          { name: 'Descending', value: 'DESC' },
        ],
      },
      {
        displayName: 'Start Index',
        name: 'startIndex',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 1,
        description: 'The index of the first record to return (1-based). Ignored when Return All is on.',
      },
      {
        displayName: 'User',
        name: 'user',
        type: 'string',
        default: '',
        description: 'Only return changes made by this Eclipse user',
      },
    ],
  },
];
