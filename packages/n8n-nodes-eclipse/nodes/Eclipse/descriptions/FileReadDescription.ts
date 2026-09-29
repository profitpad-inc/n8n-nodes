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
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: {
      show: {
        resource: ['fileRead'],
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
        resource: ['fileRead'],
        operation: ['getMany'],
        returnAll: [true],
      },
    },
    options: [
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
    ],
  },
  {
    displayName: 'Page Size',
    name: 'pageSize',
    type: 'number',
    typeOptions: { minValue: 1 },
    default: 10,
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
        displayName: 'ID',
        name: 'id',
        type: 'string',
        default: '',
        placeholder: '11329 or 11329,11330',
        description: 'Only return records with these IDs (matched against the record\'s @ID). Separate multiple IDs with commas. Applied after the records are fetched, since the API does not support it.',
      },
      {
        displayName: 'Key Names or IDs',
        name: 'keys',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getFileKeys',
          loadOptionsDependsOn: ['fileName'],
        },
        default: [],
        description: 'Only return these keys from each record\'s user-defined data (keys are loaded by reading one record from the file, and filtering happens after fetching). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Start Index',
        name: 'startIndex',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 1,
        description: 'The index of the first record to return (1-based). Ignored when Return All is on.',
      },
    ],
  },
];
