import { INodeProperties } from 'n8n-workflow';

export const productDescription: INodeProperties[] = [
  // ── Product operations ────────────────────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['product'],
      },
    },
    options: [
      {
        name: 'Get',
        value: 'get',
        description: 'Retrieve a single product by ID',
        action: 'Get a product',
      },
      {
        name: 'Get Many',
        value: 'getMany',
        description: 'Retrieve a list of products',
        action: 'Get many products',
      },
      {
        name: 'Product Inventory Pricing Inquiry',
        value: 'getProductInventoryPricingInquiry',
        description: 'Retrieve inventory and pricing for a product and customer',
        action: 'Get product inventory pricing inquiry',
      },
    ],
    default: 'getMany',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: {
      show: {
        resource: ['product'],
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
    description: 'Number of products to return per page',
    displayOptions: {
      show: {
        resource: ['product'],
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
        resource: ['product'],
        operation: ['getMany'],
      },
    },
  },
  {
    displayName: 'Fields to Include',
    name: 'fieldsToInclude',
    type: 'string',
    default: '',
    placeholder: 'ID,productId,prices.unitPrice',
    description: 'Comma-separated list of fields to include in each result. Supports dot notation for nested fields (e.g. prices.unitPrice).',
    displayOptions: {
      show: {
        resource: ['product'],
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
        resource: ['product'],
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
        resource: ['product'],
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
        description: 'Filter by product ID. Separate multiple IDs with commas.',
      },
      {
        displayName: 'Keyword',
        name: 'keyword',
        type: 'string',
        default: '',
        description: 'Filter products by keyword search',
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
        description: 'Only return products updated after this date and time. Timezone is always UTC.',
      },
    ],
  },
  {
    displayName: 'Product ID',
    name: 'productId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the product to retrieve',
    displayOptions: {
      show: {
        resource: ['product'],
        operation: ['get'],
      },
    },
  },

  // ── Product Inventory Pricing Inquiry ─────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['productInventoryPricingInquiry'],
      },
    },
    options: [
      {
        name: 'Get',
        value: 'get',
        description: 'Retrieve inventory and pricing for a product and customer',
        action: 'Get product inventory pricing inquiry',
      },
    ],
    default: 'get',
  },
  {
    displayName: 'Customer ID',
    name: 'pricingCustomerId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the customer',
    displayOptions: {
      show: {
        resource: ['product'],
        operation: ['getProductInventoryPricingInquiry'],
      },
    },
  },
  {
    displayName: 'Product ID',
    name: 'pricingProductId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the product',
    displayOptions: {
      show: {
        resource: ['product'],
        operation: ['getProductInventoryPricingInquiry'],
      },
    },
  },
  {
    displayName: 'Consider User Auth Branch',
    name: 'considerUserAuthBranch',
    type: 'boolean',
    default: false,
    description: 'Whether to consider the user\'s authorized branch when retrieving pricing',
    displayOptions: {
      show: {
        resource: ['product'],
        operation: ['getProductInventoryPricingInquiry'],
      },
    },
  },
  {
    displayName: 'User ID',
    name: 'pricingUserId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the user whose authorized branch will be considered',
    displayOptions: {
      show: {
        resource: ['product'],
        operation: ['getProductInventoryPricingInquiry'],
        considerUserAuthBranch: [true],
      },
    },
  },
];
