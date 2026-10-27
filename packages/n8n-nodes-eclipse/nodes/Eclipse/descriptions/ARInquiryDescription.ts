import { INodeProperties } from 'n8n-workflow';

const showForArInquiry = {
  show: {
    resource: ['customer'],
    operation: ['arInquiry'],
  },
};

export const arInquiryDescription: INodeProperties[] = [
  {
    displayName: 'Customer ID',
    name: 'arInquiryCustomerId',
    type: 'string',
    default: '',
    required: true,
    placeholder: '123',
    description: 'ID of the customer',
    displayOptions: showForArInquiry,
  },
  {
    displayName: 'Currency',
    name: 'arInquiryCurrency',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'USD',
    description: 'Currency for the AR inquiry. Must be set up in the Eclipse control records under "Valid Foreign Currencies".',
    displayOptions: showForArInquiry,
  },
  {
    displayName: 'Page Size',
    name: 'arInquiryPageSize',
    type: 'number',
    typeOptions: { minValue: 1 },
    default: 100,
    required: true,
    description: 'Number of records to request',
    displayOptions: showForArInquiry,
  },
  {
    displayName: 'Additional Options',
    name: 'arInquiryOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: showForArInquiry,
    options: [
      {
        displayName: 'AR Inquiry Details',
        name: 'arInquiryDetails',
        type: 'boolean',
        default: false,
        description: 'Whether to return the AR inquiry details',
      },
      {
        displayName: 'As Of Date',
        name: 'asOfDate',
        type: 'string',
        default: '',
        placeholder: '2026-01-01',
        description: 'Run the inquiry as of this date',
      },
      {
        displayName: 'Bill To Only',
        name: 'billToOnly',
        type: 'boolean',
        default: false,
        description: 'Whether to include bill to only orders',
      },
      {
        displayName: 'Branches',
        name: 'branches',
        type: 'string',
        default: '',
        placeholder: '1 or 1,2',
        description: 'Branch or branches to make the inquiry for. Separate multiple branches with commas. Leave empty for all branches.',
      },
      {
        displayName: 'Months',
        name: 'months',
        type: 'options',
        options: [
          { name: '6', value: 6 },
          { name: '12', value: 12 },
        ],
        default: 6,
        description: 'Period of months for the inquiry',
      },
      {
        displayName: 'Open Orders View',
        name: 'openOrdersView',
        type: 'boolean',
        default: false,
        description: 'Whether to use the all open orders view',
      },
      {
        displayName: 'Start Index',
        name: 'startIndex',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 1,
        description: 'Index of the first result to retrieve, used for paging',
      },
    ],
  },
];
