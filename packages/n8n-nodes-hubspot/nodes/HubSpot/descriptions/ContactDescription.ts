import { INodeProperties } from 'n8n-workflow';

export const contactDescription: INodeProperties[] = [
  // ── Contact operations ────────────────────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['contact'],
      },
    },
    options: [
      {
        name: 'Get',
        value: 'get',
        description: 'Retrieve a single contact by ID',
        action: 'Get a contact',
      },
      {
        name: 'Get Many',
        value: 'getMany',
        description: 'Retrieve a list of contacts',
        action: 'Get many contacts',
      },
    ],
    default: 'getMany',
  },

  // ── Get Many options ──────────────────────────────────────────────────
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Page Size',
    name: 'pageSize',
    type: 'number',
    typeOptions: { minValue: 1 },
    default: 10,
    description: 'Number of contacts to return per page',
    displayOptions: {
      show: {
        resource: ['contact'],
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
        resource: ['contact'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Fields to Include',
    name: 'fieldsToInclude',
    type: 'string',
    default: '',
    placeholder: 'ID,firstName,phones.number',
    description: 'Comma-separated list of fields to include in each result. Supports dot notation for nested fields (e.g. phones.number).',
    displayOptions: {
      show: {
        resource: ['contact'],
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
    placeholder: 'updateKey,sortBy',
    description: 'Comma-separated list of fields to exclude from each result',
    displayOptions: {
      show: {
        resource: ['contact'],
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
        resource: ['contact'],
        operation: ['getMany'],
      },
    },
    options: [
      {
        displayName: 'ID',
        name: 'id',
        type: 'string',
        default: '',
        placeholder: '123 or 123,456,789',
        description: 'Filter by contact ID. Separate multiple IDs with commas.',
      },
      {
        displayName: 'Keyword',
        name: 'keyword',
        type: 'string',
        default: '',
        description: 'Filter contacts by keyword search',
      },
      {
        displayName: 'Start Index',
        name: 'startIndex',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 1,
        description: 'The index of the first record to return (1-based)',
      },
      {
        displayName: 'Updated After',
        name: 'updatedAfter',
        type: 'dateTime',
        default: '',
        description: 'Only return contacts updated after this date and time. Timezone is always UTC.',
      },
    ],
  },

  // ── Get single contact ────────────────────────────────────────────────
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the contact to retrieve',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['get'],
      },
    },
  },
];
