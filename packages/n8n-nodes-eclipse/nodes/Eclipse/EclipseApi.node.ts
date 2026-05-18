import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
  NodeApiError,
  NodeConnectionTypes,
} from 'n8n-workflow';

// Eclipse requires a session token obtained from POST /Sessions before any
// other API call. This pre-auth step cannot go through httpRequestWithAuthentication
// because the token is not a static credential — it is created on demand here.
async function createSession(
  context: IExecuteFunctions,
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const response = await context.helpers.httpRequest({
    method: 'POST',
    url: `${baseUrl}/Sessions`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: { username, password },
    json: true,
  });
  return response.sessionToken as string;
}

export class EclipseApi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Epicor Eclipse',
    name: 'eclipseApi',
    icon: 'file:eclipse-icon.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with the Epicor Eclipse API.',
    usableAsTool: true,
    defaults: {
      name: 'Eclipse API',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'eclipseApi',
        required: true,
      },
    ],
    properties: [
      // ── Resource ──────────────────────────────────────────────────────────
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Contact',
            value: 'contact',
          },
          {
            name: 'Customer',
            value: 'customer',
          },
          {
            name: 'Product',
            value: 'product',
          },
          {
            name: 'Sales Order',
            value: 'salesOrder',
          },
        ],
        default: 'contact',
      },

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
            description: 'Retrieve a single contact by ID.',
            action: 'Get a contact',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            description: 'Retrieve a list of contacts.',
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
        description: 'Whether to return all results or only up to a given limit.',
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
        description: 'Number of contacts to return per page.',
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
            description: 'Return all fields from each result.',
          },
          {
            name: 'All Fields Except',
            value: 'except',
            description: 'Return all fields except the specified ones from each result.',
          },
          {
            name: 'Selected Fields',
            value: 'selected',
            description: 'Return only the specified fields from each result.  Supports dot notation.',
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
        placeholder: 'firstName,lastName,emails',
        description: 'Comma-separated list of fields to include in each result.',
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
        description: 'Comma-separated list of fields to exclude from each result.',
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
            description: 'Filter contacts by keyword search.',
          },
          {
            displayName: 'Start Index',
            name: 'startIndex',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 1,
            description: 'The index of the first record to return (1-based).',
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
        description: 'The ID of the contact to retrieve.',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['get'],
          },
        },
      },

      // ── Customer operations ───────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['customer'],
          },
        },
        options: [
          {
            name: 'Get',
            value: 'get',
            description: 'Retrieve a single customer by ID.',
            action: 'Get a customer',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            description: 'Retrieve a list of customers.',
            action: 'Get many customers',
          },
        ],
        default: 'getMany',
      },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit.',
        displayOptions: {
          show: {
            resource: ['customer'],
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
        description: 'Number of customers to return per page.',
        displayOptions: {
          show: {
            resource: ['customer'],
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
            description: 'Return all fields from each result.',
          },
          {
            name: 'All Fields Except',
            value: 'except',
            description: 'Return all fields except the specified ones from each result.',
          },
          {
            name: 'Selected Fields',
            value: 'selected',
            description: 'Return only the specified fields from each result.  Supports dot notation.',
          },
        ],
        default: 'all',
        displayOptions: {
          show: {
            resource: ['customer'],
            operation: ['getMany'],
          },
        },
      },
      {
        displayName: 'Fields to Include',
        name: 'fieldsToInclude',
        type: 'string',
        default: '',
        placeholder: 'firstName,lastName,emails',
        description: 'Comma-separated list of fields to include in each result.',
        displayOptions: {
          show: {
            resource: ['customer'],
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
        description: 'Comma-separated list of fields to exclude from each result.',
        displayOptions: {
          show: {
            resource: ['customer'],
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
            resource: ['customer'],
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
            description: 'Filter by customer ID. Separate multiple IDs with commas.',
          },
          {
            displayName: 'Keyword',
            name: 'keyword',
            type: 'string',
            default: '',
            description: 'Filter customers by keyword search.',
          },
          {
            displayName: 'Start Index',
            name: 'startIndex',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 1,
            description: 'The index of the first record to return (1-based).',
          },
          {
            displayName: 'Updated After',
            name: 'updatedAfter',
            type: 'dateTime',
            default: '',
            description: 'Only return customers updated after this date and time. Timezone is always UTC.',
          },
        ],
      },
      {
        displayName: 'Customer ID',
        name: 'customerId',
        type: 'string',
        default: '',
        required: true,
        description: 'The ID of the customer to retrieve.',
        displayOptions: {
          show: {
            resource: ['customer'],
            operation: ['get'],
          },
        },
      },

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
            description: 'Retrieve a single product by ID.',
            action: 'Get a product',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            description: 'Retrieve a list of products.',
            action: 'Get many products',
          },
          {
            name: 'Product Inventory Pricing Inquiry',
            value: 'getProductInventoryPricingInquiry',
            description: 'Retrieve inventory and pricing for a product and customer.',
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
        description: 'Whether to return all results or only up to a given limit.',
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
        description: 'Number of products to return per page.',
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
            description: 'Return all fields from each result.',
          },
          {
            name: 'All Fields Except',
            value: 'except',
            description: 'Return all fields except the specified ones from each result.',
          },
          {
            name: 'Selected Fields',
            value: 'selected',
            description: 'Return only the specified fields from each result.  Supports dot notation.',
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
        placeholder: 'firstName,lastName,emails',
        description: 'Comma-separated list of fields to include in each result.',
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
        description: 'Comma-separated list of fields to exclude from each result.',
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
            description: 'Filter products by keyword search.',
          },
          {
            displayName: 'Start Index',
            name: 'startIndex',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 1,
            description: 'The index of the first record to return (1-based).',
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
        description: 'The ID of the product to retrieve.',
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
            description: 'Retrieve inventory and pricing for a product and customer.',
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
        description: 'The ID of the customer.',
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
        description: 'The ID of the product.',
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
        description: 'Whether to consider the user\'s authorized branch when retrieving pricing.',
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
        description: 'The ID of the user whose authorized branch will be considered.',
        displayOptions: {
          show: {
            resource: ['product'],
            operation: ['getProductInventoryPricingInquiry'],
            considerUserAuthBranch: [true],
          },
        },
      },

      // ── Sales Order operations ────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ['salesOrder'],
          },
        },
        options: [
          {
            name: 'Get',
            value: 'get',
            description: 'Retrieve a single sales order by ID.',
            action: 'Get a sales order',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            description: 'Retrieve a list of sales orders.',
            action: 'Get many sales orders',
          },
        ],
        default: 'getMany',
      },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit.',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
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
        description: 'Number of sales orders to return per page.',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
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
            description: 'Return all fields from each result.',
          },
          {
            name: 'All Fields Except',
            value: 'except',
            description: 'Return all fields except the specified ones from each result.',
          },
          {
            name: 'Selected Fields',
            value: 'selected',
            description: 'Return only the specified fields from each result.  Supports dot notation.',
          },
        ],
        default: 'all',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['getMany'],
          },
        },
      },
      {
        displayName: 'Fields to Include',
        name: 'fieldsToInclude',
        type: 'string',
        default: '',
        placeholder: 'firstName,lastName,emails',
        description: 'Comma-separated list of fields to include in each result.',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
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
        description: 'Comma-separated list of fields to exclude from each result.',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['getMany'],
            fieldsFilterMode: ['except'],
          },
        },
      },
      {
        displayName: 'Date Filter Options',
        name: 'dateFilterOptions',
        type: 'collection',
        placeholder: 'Add Date Filter',
        default: {},
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['getMany'],
          },
        },
        options: [
          {
            displayName: 'Last Modified Date End',
            name: 'lastModifiedDateAndTimeStampEnd',
            type: 'dateTime',
            default: '',
            description: 'Only return orders last modified on or before this date and time. Timezone is always UTC.',
          },
          {
            displayName: 'Last Modified Date Start',
            name: 'lastModifiedDateAndTimeStampStart',
            type: 'dateTime',
            default: '',
            description: 'Only return orders last modified on or after this date and time. Timezone is always UTC.',
          },
          {
            displayName: 'Order Date End',
            name: 'orderDateEnd',
            type: 'dateTime',
            default: '',
            description: 'Only return orders created on or before this date and time. Timezone is always UTC.',
          },
          {
            displayName: 'Order Date Start',
            name: 'orderDateStart',
            type: 'dateTime',
            default: '',
            description: 'Only return orders created on or after this date and time. Timezone is always UTC.',
          },
          {
            displayName: 'Ship Date',
            name: 'shipDate',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ship date. Separate multiple values with commas.',
          },
          {
            displayName: 'Ship Date End',
            name: 'shipDateEnd',
            type: 'dateTime',
            default: '',
            description: 'Only return orders with a ship date on or before this date. Timezone is always UTC.',
          },
          {
            displayName: 'Ship Date Start',
            name: 'shipDateStart',
            type: 'dateTime',
            default: '',
            description: 'Only return orders with a ship date on or after this date. Timezone is always UTC.',
          },
        ],
      },
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['getMany'],
          },
        },
        options: [
          {
            displayName: 'Bill To',
            name: 'billTo',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by bill-to ID. Separate multiple values with commas.',
          },
          {
            displayName: 'ID',
            name: 'id',
            type: 'string',
            default: '',
            placeholder: 'S2681000.0001 or S2681000.0001,S2681000.0002',
            description: 'Filter by sales order ID. Separate multiple IDs with commas.',
          },
          {
            displayName: 'Inside Salesperson',
            name: 'insideSalesperson',
            type: 'string',
            default: '',
            description: 'Filter by inside salesperson. Separate multiple values with commas.',
          },
          {
            displayName: 'Only IDs',
            name: 'onlyIds',
            type: 'boolean',
            default: false,
            description: 'Whether to return only order IDs instead of full records.',
          },
          {
            displayName: 'Order Status',
            name: 'orderStatus',
            type: 'multiOptions',
            options: [
              { name: 'Bid', value: 'Bid' },
              { name: 'Call When Available', value: 'CallWhenAvailable' },
              { name: 'Call When Complete', value: 'CallWhenComplete' },
              { name: 'Call When Specified', value: 'CallWhenSpecified' },
              { name: 'Cancel', value: 'Cancel' },
              { name: 'Direct', value: 'Direct' },
              { name: 'Direct Through Stock', value: 'DirectThroughStock' },
              { name: 'Invoice', value: 'Invoice' },
              { name: 'Payment', value: 'Payment' },
              { name: 'Pick Up Now', value: 'PickUpNow' },
              { name: 'Reserve Inventory', value: 'ReserveInventory' },
              { name: 'Ship Item Complete', value: 'ShipItemComplete' },
              { name: 'Ship Ticket', value: 'ShipTicket' },
              { name: 'Ship When Available', value: 'ShipWhenAvailable' },
              { name: 'Ship When Complete', value: 'ShipWhenComplete' },
              { name: 'Ship When Specified', value: 'ShipWhenSpecified' },
            ],
            default: [],
            description: 'Filter by order status. Multiple statuses are allowed.',
          },
          {
            displayName: 'Outside Salesperson',
            name: 'outsideSalesperson',
            type: 'string',
            default: '',
            description: 'Filter by outside salesperson. Separate multiple values with commas.',
          },
          {
            displayName: 'Price Branch',
            name: 'priceBranch',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by price branch. Separate multiple values with commas.',
          },
          {
            displayName: 'Ship Branch',
            name: 'shipBranch',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ship branch. Separate multiple values with commas.',
          },
          {
            displayName: 'Ship To',
            name: 'shipTo',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ship-to ID. Separate multiple values with commas.',
          },
          {
            displayName: 'Ship Via',
            name: 'shipVia',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ship via. Separate multiple values with commas.',
          },
          {
            displayName: 'Sort',
            name: 'sort',
            type: 'options',
            options: [
              { name: 'Last Modified Date (Ascending)', value: '+LastModifiedDateAndTimeStamp' },
              { name: 'Last Modified Date (Descending)', value: '-LastModifiedDateAndTimeStamp' },
              { name: 'Order Date (Ascending)', value: '+orderDate' },
              { name: 'Order Date (Descending)', value: '-orderDate' },
              { name: 'Ship Date (Ascending)', value: '+shipDate' },
              { name: 'Ship Date (Descending)', value: '-shipDate' },
            ],
            default: '+orderDate',
            description: 'Sort order for results.',
          },
          {
            displayName: 'Start Index',
            name: 'startIndex',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 1,
            description: 'The index of the first record to return (1-based).',
          },
          {
            displayName: 'Writer',
            name: 'writer',
            type: 'string',
            default: '',
            description: 'Filter by writer. Separate multiple values with commas.',
          },
        ],
      },
      {
        displayName: 'Sales Order ID',
        name: 'salesOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2681000.0001',
        description: 'The ID of the sales order to retrieve.',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['get'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Pull credentials and obtain a session token
    const credentials = await this.getCredentials('eclipseApi');
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    const username = credentials.username as string;
    const password = credentials.password as string;

    const sessionToken = await createSession(this, baseUrl, username, password);

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    const headers = {
      Accept: 'application/json',
      sessionToken,
    };

    for (let i = 0; i < items.length; i++) {
      try {
        if (resource === 'contact') {

          // ── GET MANY ────────────────────────────────────────────────────
          if (operation === 'getMany') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i) as number;
            const fieldsFilterMode = this.getNodeParameter('fieldsFilterMode', i) as string;

            const applyFieldFilter = (results: JsonObject[]): JsonObject[] => {
              if (fieldsFilterMode === 'selected') {
                const fields = new Set(
                  (this.getNodeParameter('fieldsToInclude', i) as string)
                    .split(',').map((f) => f.trim()).filter(Boolean),
                );
                fields.add('id');
                const copyPath = (src: unknown, dst: JsonObject, parts: string[]): void => {
                  if (parts.length === 0 || src == null || Array.isArray(src) || typeof src !== 'object') return;
                  const [head, ...tail] = parts;
                  const srcVal = (src as JsonObject)[head];
                  if (tail.length === 0) {
                    if (srcVal !== undefined) dst[head] = srcVal as JsonObject[string];
                    return;
                  }
                  if (Array.isArray(srcVal)) {
                    if (!Array.isArray(dst[head])) {
                      dst[head] = (srcVal as unknown[]).map(() => ({} as JsonObject)) as unknown as JsonObject[string];
                    }
                    (srcVal as unknown[]).forEach((item, idx) => {
                      copyPath(item, (dst[head] as unknown as JsonObject[])[idx], tail);
                    });
                  } else if (srcVal != null && typeof srcVal === 'object') {
                    if (typeof dst[head] !== 'object' || dst[head] === null) dst[head] = {};
                    copyPath(srcVal, dst[head] as JsonObject, tail);
                  }
                };
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const f of fields) copyPath(r, out, f.split('.'));
                  return out;
                });
              }
              if (fieldsFilterMode === 'except') {
                const excluded = new Set(
                  (this.getNodeParameter('fieldsToExclude', i) as string)
                    .split(',').map((f) => f.trim()).filter(Boolean),
                );
                excluded.delete('id');
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const [k, v] of Object.entries(r)) if (!excluded.has(k)) out[k] = v;
                  return out;
                });
              }
              return results;
            };

            const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
              updatedAfter?: string;
              keyword?: string;
              startIndex?: number;
              id?: string;
            };

            const ids = additionalOptions.id
              ? additionalOptions.id.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            const buildUrl = (startIndex: number): string => {
              const params = new URLSearchParams();
              params.set('pageSize', String(pageSize));
              params.set('startIndex', String(startIndex));
              params.set('includeTotalItems', 'true');
              for (const id of ids) params.append('id', id);
              if (additionalOptions.updatedAfter) params.set('updatedAfter', additionalOptions.updatedAfter);
              if (additionalOptions.keyword) params.set('keyword', additionalOptions.keyword);
              return `${baseUrl}/Contacts?${params.toString()}`;
            };

            if (returnAll) {
              let currentStart = 1;

              while (true) {
                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                  method: 'GET',
                  url: buildUrl(currentStart),
                  headers,
                });

                const results: JsonObject[] = response.results ?? [];
                returnData.push({
                  json: { ...response, results: applyFieldFilter(results) },
                  pairedItem: { item: i },
                });

                if (results.length < pageSize) break;
                currentStart += pageSize;
              }
            } else {
              const startIndex = additionalOptions.startIndex ?? 1;

              const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                method: 'GET',
                url: buildUrl(startIndex),
                headers,
              });

              const results: JsonObject[] = response.results ?? [];
              returnData.push({
                json: { ...response, results: applyFieldFilter(results) },
                pairedItem: { item: i },
              });
            }
          }

          // ── GET SINGLE ──────────────────────────────────────────────────
          if (operation === 'get') {
            const contactId = this.getNodeParameter('contactId', i) as string;

            const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/Contacts`,
              headers,
              qs: { id: contactId, includeTotalItems: 'true' },
            });

            returnData.push({ json: response, pairedItem: { item: i } });
          }
        }

        if (resource === 'customer' || resource === 'product') {
          const endpoint = resource === 'customer' ? 'Customers' : 'Products';
          const idParam = resource === 'customer' ? 'customerId' : 'productId';

          // ── GET MANY ──────────────────────────────────────────────────
          if (operation === 'getMany') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i) as number;
            const fieldsFilterMode = this.getNodeParameter('fieldsFilterMode', i) as string;

            const applyFieldFilter = (results: JsonObject[]): JsonObject[] => {
              if (fieldsFilterMode === 'selected') {
                const fields = new Set(
                  (this.getNodeParameter('fieldsToInclude', i) as string)
                    .split(',').map((f) => f.trim()).filter(Boolean),
                );
                fields.add('id');
                const copyPath = (src: unknown, dst: JsonObject, parts: string[]): void => {
                  if (parts.length === 0 || src == null || Array.isArray(src) || typeof src !== 'object') return;
                  const [head, ...tail] = parts;
                  const srcVal = (src as JsonObject)[head];
                  if (tail.length === 0) {
                    if (srcVal !== undefined) dst[head] = srcVal as JsonObject[string];
                    return;
                  }
                  if (Array.isArray(srcVal)) {
                    if (!Array.isArray(dst[head])) {
                      dst[head] = (srcVal as unknown[]).map(() => ({} as JsonObject)) as unknown as JsonObject[string];
                    }
                    (srcVal as unknown[]).forEach((item, idx) => {
                      copyPath(item, (dst[head] as unknown as JsonObject[])[idx], tail);
                    });
                  } else if (srcVal != null && typeof srcVal === 'object') {
                    if (typeof dst[head] !== 'object' || dst[head] === null) dst[head] = {};
                    copyPath(srcVal, dst[head] as JsonObject, tail);
                  }
                };
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const f of fields) copyPath(r, out, f.split('.'));
                  return out;
                });
              }
              if (fieldsFilterMode === 'except') {
                const excluded = new Set(
                  (this.getNodeParameter('fieldsToExclude', i) as string)
                    .split(',').map((f) => f.trim()).filter(Boolean),
                );
                excluded.delete('id');
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const [k, v] of Object.entries(r)) if (!excluded.has(k)) out[k] = v;
                  return out;
                });
              }
              return results;
            };

            const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
              updatedAfter?: string;
              keyword?: string;
              startIndex?: number;
              id?: string;
            };

            const ids = additionalOptions.id
              ? additionalOptions.id.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            const buildUrl = (startIndex: number): string => {
              const params = new URLSearchParams();
              params.set('pageSize', String(pageSize));
              params.set('startIndex', String(startIndex));
              params.set('includeTotalItems', 'true');
              for (const id of ids) params.append('id', id);
              if (additionalOptions.updatedAfter) params.set('updatedAfter', additionalOptions.updatedAfter);
              if (additionalOptions.keyword) params.set('keyword', additionalOptions.keyword);
              return `${baseUrl}/${endpoint}?${params.toString()}`;
            };

            if (returnAll) {
              let currentStart = 1;

              while (true) {
                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                  method: 'GET',
                  url: buildUrl(currentStart),
                  headers,
                });

                const results: JsonObject[] = response.results ?? [];
                returnData.push({
                  json: { ...response, results: applyFieldFilter(results) },
                  pairedItem: { item: i },
                });

                if (results.length < pageSize) break;
                currentStart += pageSize;
              }
            } else {
              const startIndex = additionalOptions.startIndex ?? 1;

              const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                method: 'GET',
                url: buildUrl(startIndex),
                headers,
              });

              const results: JsonObject[] = response.results ?? [];
              returnData.push({
                json: { ...response, results: applyFieldFilter(results) },
                pairedItem: { item: i },
              });
            }
          }

          // ── GET SINGLE ──────────────────────────────────────────────────
          if (operation === 'get') {
            const recordId = this.getNodeParameter(idParam, i) as string;

            const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/${endpoint}`,
              headers,
              qs: { id: recordId, includeTotalItems: 'true' },
            });

            returnData.push({ json: response, pairedItem: { item: i } });
          }
        }

        if (resource === 'salesOrder') {

          // ── GET MANY ────────────────────────────────────────────────────
          if (operation === 'getMany') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i) as number;
            const fieldsFilterMode = this.getNodeParameter('fieldsFilterMode', i) as string;

            const applyFieldFilter = (results: JsonObject[]): JsonObject[] => {
              if (fieldsFilterMode === 'selected') {
                const fields = new Set(
                  (this.getNodeParameter('fieldsToInclude', i) as string)
                    .split(',').map((f) => f.trim()).filter(Boolean),
                );
                fields.add('id');
                const copyPath = (src: unknown, dst: JsonObject, parts: string[]): void => {
                  if (parts.length === 0 || src == null || Array.isArray(src) || typeof src !== 'object') return;
                  const [head, ...tail] = parts;
                  const srcVal = (src as JsonObject)[head];
                  if (tail.length === 0) {
                    if (srcVal !== undefined) dst[head] = srcVal as JsonObject[string];
                    return;
                  }
                  if (Array.isArray(srcVal)) {
                    if (!Array.isArray(dst[head])) {
                      dst[head] = (srcVal as unknown[]).map(() => ({} as JsonObject)) as unknown as JsonObject[string];
                    }
                    (srcVal as unknown[]).forEach((item, idx) => {
                      copyPath(item, (dst[head] as unknown as JsonObject[])[idx], tail);
                    });
                  } else if (srcVal != null && typeof srcVal === 'object') {
                    if (typeof dst[head] !== 'object' || dst[head] === null) dst[head] = {};
                    copyPath(srcVal, dst[head] as JsonObject, tail);
                  }
                };
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const f of fields) copyPath(r, out, f.split('.'));
                  return out;
                });
              }
              if (fieldsFilterMode === 'except') {
                const excluded = new Set(
                  (this.getNodeParameter('fieldsToExclude', i) as string)
                    .split(',').map((f) => f.trim()).filter(Boolean),
                );
                excluded.delete('id');
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const [k, v] of Object.entries(r)) if (!excluded.has(k)) out[k] = v;
                  return out;
                });
              }
              return results;
            };

            const dateFilterOptions = this.getNodeParameter('dateFilterOptions', i) as {
              shipDate?: string;
              shipDateStart?: string;
              shipDateEnd?: string;
              orderDateStart?: string;
              orderDateEnd?: string;
              lastModifiedDateAndTimeStampStart?: string;
              lastModifiedDateAndTimeStampEnd?: string;
            };

            const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
              id?: string;
              billTo?: string;
              shipTo?: string;
              shipBranch?: string;
              priceBranch?: string;
              shipVia?: string;
              insideSalesperson?: string;
              outsideSalesperson?: string;
              writer?: string;
              orderStatus?: string[];
              onlyIds?: boolean;
              sort?: string;
              startIndex?: number;
            };

            const splitParam = (val: string | undefined): string[] =>
              val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

            const buildUrl = (startIndex: number): string => {
              const params = new URLSearchParams();
              params.set('pageSize', String(pageSize));
              params.set('startIndex', String(startIndex));
              params.set('includeTotalItems', 'true');
              for (const v of splitParam(additionalOptions.id)) params.append('id', v);
              for (const v of splitParam(additionalOptions.billTo)) params.append('BillTo', v);
              for (const v of splitParam(additionalOptions.shipTo)) params.append('ShipTo', v);
              for (const v of splitParam(additionalOptions.shipBranch)) params.append('ShipBranch', v);
              for (const v of splitParam(additionalOptions.priceBranch)) params.append('PriceBranch', v);
              for (const v of splitParam(additionalOptions.shipVia)) params.append('ShipVia', v);
              for (const v of splitParam(dateFilterOptions.shipDate)) params.append('ShipDate', v);
              for (const v of splitParam(additionalOptions.insideSalesperson)) params.append('InsideSalesperson', v);
              for (const v of splitParam(additionalOptions.outsideSalesperson)) params.append('OutsideSalesperson', v);
              for (const v of splitParam(additionalOptions.writer)) params.append('Writer', v);
              for (const v of (additionalOptions.orderStatus ?? [])) params.append('OrderStatus', v);
              if (dateFilterOptions.shipDateStart) params.set('ShipDateStart', dateFilterOptions.shipDateStart);
              if (dateFilterOptions.shipDateEnd) params.set('ShipDateEnd', dateFilterOptions.shipDateEnd);
              if (dateFilterOptions.orderDateStart) params.set('OrderDateStart', dateFilterOptions.orderDateStart);
              if (dateFilterOptions.orderDateEnd) params.set('OrderDateEnd', dateFilterOptions.orderDateEnd);
              if (dateFilterOptions.lastModifiedDateAndTimeStampStart) params.set('LastModifiedDateAndTimeStampStart', dateFilterOptions.lastModifiedDateAndTimeStampStart);
              if (dateFilterOptions.lastModifiedDateAndTimeStampEnd) params.set('LastModifiedDateAndTimeStampEnd', dateFilterOptions.lastModifiedDateAndTimeStampEnd);
              if (additionalOptions.onlyIds) params.set('onlyIds', 'true');
              if (additionalOptions.sort) params.set('sort', additionalOptions.sort);
              return `${baseUrl}/SalesOrders?${params.toString()}`;
            };

            if (returnAll) {
              let currentStart = 1;

              while (true) {
                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                  method: 'GET',
                  url: buildUrl(currentStart),
                  headers,
                });

                const results: JsonObject[] = response.results ?? [];
                returnData.push({
                  json: { ...response, results: applyFieldFilter(results) },
                  pairedItem: { item: i },
                });

                if (results.length < pageSize) break;
                currentStart += pageSize;
              }
            } else {
              const startIndex = additionalOptions.startIndex ?? 1;

              const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                method: 'GET',
                url: buildUrl(startIndex),
                headers,
              });

              const results: JsonObject[] = response.results ?? [];
              returnData.push({
                json: { ...response, results: applyFieldFilter(results) },
                pairedItem: { item: i },
              });
            }
          }

          // ── GET SINGLE ──────────────────────────────────────────────────
          if (operation === 'get') {
            const salesOrderId = this.getNodeParameter('salesOrderId', i) as string;

            const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/SalesOrders`,
              headers,
              qs: { id: salesOrderId, includeTotalItems: 'true' },
            });

            returnData.push({ json: response, pairedItem: { item: i } });
          }
        }

        if (resource === 'product' && operation === 'getProductInventoryPricingInquiry') {
          const customerId = this.getNodeParameter('pricingCustomerId', i) as string;
          const productId = this.getNodeParameter('pricingProductId', i) as string;
          const considerUserAuthBranch = this.getNodeParameter('considerUserAuthBranch', i) as boolean;
          const userId = considerUserAuthBranch ? this.getNodeParameter('pricingUserId', i) as string : undefined;

          const sharedQs: Record<string, string> = { CustomerId: customerId, ProductId: productId };
          if (considerUserAuthBranch && userId) sharedQs.UserId = userId;

          const [inventoryResponse, pricingResponse] = await Promise.all([
            this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/ProductInventoryPricingInquiry`,
              headers,
              qs: { ...sharedQs, ConsiderUserAuthBranch: String(considerUserAuthBranch) },
            }),
            this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/ProductPricingInquiry`,
              headers,
              qs: { ...sharedQs, ShowCost: 'true', ConsiderUserAuthBranch: String(considerUserAuthBranch) },
            }),
          ]);

          returnData.push({ json: { ...pricingResponse, ...inventoryResponse }, pairedItem: { item: i } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new NodeApiError(this.getNode(), error as JsonObject);
      }
    }

    return [returnData];
  }
}
