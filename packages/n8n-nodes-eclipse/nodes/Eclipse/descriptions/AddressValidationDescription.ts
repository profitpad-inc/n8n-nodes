import { INodeProperties } from 'n8n-workflow';

const showForValidate = {
  show: {
    resource: ['addressValidation'],
    operation: ['validate'],
  },
};

export const addressValidationDescription: INodeProperties[] = [
  // ── Address Validation operations ─────────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['addressValidation'],
      },
    },
    options: [
      {
        name: 'Validate',
        value: 'validate',
        description: 'Validate an address',
        action: 'Validate an address',
      },
    ],
    default: 'validate',
  },

  {
    displayName: 'Street Line One',
    name: 'addressStreetLineOne',
    type: 'string',
    default: '',
    description: 'The address line 1',
    displayOptions: showForValidate,
  },
  {
    displayName: 'Street Line Two',
    name: 'addressStreetLineTwo',
    type: 'string',
    default: '',
    description: 'The address line 2',
    displayOptions: showForValidate,
  },
  {
    displayName: 'Street Line Three',
    name: 'addressStreetLineThree',
    type: 'string',
    default: '',
    description: 'The address line 3',
    displayOptions: showForValidate,
  },
  {
    displayName: 'City',
    name: 'addressCity',
    type: 'string',
    default: '',
    description: 'The address city',
    displayOptions: showForValidate,
  },
  {
    displayName: 'State',
    name: 'addressState',
    type: 'string',
    default: '',
    description: 'The address state',
    displayOptions: showForValidate,
  },
  {
    displayName: 'Postal Code',
    name: 'addressPostalCode',
    type: 'string',
    default: '',
    description: 'The address zip code',
    displayOptions: showForValidate,
  },
  {
    displayName: 'Country',
    name: 'addressCountry',
    type: 'string',
    default: '',
    description: 'The address country',
    displayOptions: showForValidate,
  },
];

// Node parameter name → Eclipse query param name, in request order.
export const addressValidationQueryParams: Array<[string, string]> = [
  ['addressStreetLineOne', 'StreetLineOne'],
  ['addressStreetLineTwo', 'StreetLineTwo'],
  ['addressStreetLineThree', 'StreetLineThree'],
  ['addressCity', 'City'],
  ['addressState', 'State'],
  ['addressPostalCode', 'PostalCode'],
  ['addressCountry', 'Country'],
];
