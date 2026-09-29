import { INodeProperties } from 'n8n-workflow';

export const fileReadDescription: INodeProperties[] = [
  // ── File Read operations ──────────────────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['fileRead'],
      },
    },
    options: [
      {
        name: 'Get Many',
        value: 'getMany',
        description: 'Read records from an Eclipse file',
        action: 'Get many file records',
      },
    ],
    default: 'getMany',
  },

  {
    displayName: 'File Name',
    name: 'fileName',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'CUST.CLASS',
    description: 'The name of the Eclipse file to read (used as the URL parameter)',
    displayOptions: {
      show: {
        resource: ['fileRead'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Page Size',
    name: 'pageSize',
    type: 'number',
    typeOptions: { minValue: 1 },
    default: 1000,
    description: 'Number of records to request per page',
    displayOptions: {
      show: {
        resource: ['fileRead'],
        operation: ['getMany'],
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
        resource: ['fileRead'],
        operation: ['getMany'],
      },
    },
    options: [
      {
        displayName: 'Hide Empty Records',
        name: 'hideEmpty',
        type: 'boolean',
        default: false,
        description: 'Whether to hide records where every selected key is null or empty. If no keys are selected, all keys except ID are checked.',
      },
      {
        displayName: 'ID',
        name: 'id',
        type: 'string',
        default: '',
        placeholder: '11329 or 11329,11330',
        description: 'Only return records with these IDs (matched against the record\'s @ID). Separate multiple IDs with commas. Applied after the records are fetched, since the API does not support it.',
      },
      {
        // eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
        displayName: 'Keys',
        name: 'keys',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getFileKeys',
          loadOptionsDependsOn: ['fileName'],
        },
        default: [],
        // eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-multi-options
        description: 'Only return these keys from each record\'s user-defined data (keys are loaded by reading one record from the file, and filtering happens after fetching). The ID key is always included. Choose from the list, or specify keys using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
];
