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
        placeholder: 'firstName,lastName,emails',
        description: 'Comma-separated list of fields to include in each result',
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
            name: 'Create',
            value: 'create',
            description: 'Create a new customer',
            action: 'Create a customer',
          },
          {
            name: 'Get',
            value: 'get',
            description: 'Retrieve a single customer by ID',
            action: 'Get a customer',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            description: 'Retrieve a list of customers',
            action: 'Get many customers',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Update an existing customer',
            action: 'Update a customer',
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
        description: 'Number of customers to return per page',
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
        description: 'Comma-separated list of fields to include in each result',
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
        description: 'Comma-separated list of fields to exclude from each result',
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
            description: 'Filter customers by keyword search',
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
        description: 'The ID of the customer',
        displayOptions: {
          show: {
            resource: ['customer'],
            operation: ['get', 'update'],
          },
        },
      },

      // ── Create customer fields ────────────────────────────────────────────
      {
        displayName: 'Input Mode',
        name: 'inputMode',
        type: 'options',
        options: [
          { name: 'Custom JSON', value: 'json', description: 'Provide a raw JSON body' },
          { name: 'Fields', value: 'fields', description: 'Fill in individual fields' },
        ],
        default: 'fields',
        displayOptions: { show: { resource: ['customer'], operation: ['create'] } },
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        description: 'The name of the customer',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
      },
      {
        displayName: 'Is BillTo',
        name: 'isBillTo',
        type: 'boolean',
        default: true,
        required: true,
        description: 'Whether this customer is a bill-to customer',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
      },
      {
        displayName: 'Is ShipTo',
        name: 'isShipTo',
        type: 'boolean',
        default: true,
        required: true,
        description: 'Whether this customer is a ship-to customer',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
      },
      {
        displayName: 'Sort By',
        name: 'sortBy',
        type: 'string',
        default: '',
        required: true,
        description: 'Sort key for the customer. Maximum 12 characters.',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
      },
      {
        displayName: 'Name Index',
        name: 'nameIndex',
        type: 'string',
        default: '',
        required: true,
        description: 'Name index for the customer. Maximum 12 characters.',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
      },
      {
        displayName: 'BillTo ID',
        name: 'billToId',
        type: 'number',
        default: 0,
        required: true,
        description: 'The ID of the existing bill-to customer. Required when "Is BillTo" is false.',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'], isBillTo: [false] } },
      },
      {
        displayName: 'Types',
        name: 'types',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Type',
        default: {},
        description: 'Customer types (e.g. PROPANE, LVL-2)',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
        options: [
          {
            name: 'typeValues',
            displayName: 'Type',
            values: [{ displayName: 'Type', name: 'type', type: 'string', default: '', description: 'The customer type value (e.g. PROPANE)' }],
          },
        ],
      },
      {
        displayName: 'ShipTo List',
        name: 'shipToLists',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add ShipTo',
        default: {},
        description: 'Associated ship-to customers',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
        options: [
          {
            name: 'shipToValues',
            displayName: 'ShipTo',
            values: [{ displayName: 'ShipTo ID', name: 'shipToId', type: 'number', default: 0 }],
          },
        ],
      },
      {
        displayName: 'Contacts',
        name: 'contacts',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Contact',
        default: {},
        description: 'Contacts to associate with the customer',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
        options: [
          {
            name: 'contactValues',
            displayName: 'Contact',
            values: [{ displayName: 'Contact ID', name: 'id', type: 'number', default: 0 }],
          },
        ],
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['fields'] } },
        options: [
          { displayName: 'Address Line 1', name: 'addressLine1', type: 'string', default: '' },
          { displayName: 'Address Line 2', name: 'addressLine2', type: 'string', default: '' },
          { displayName: 'City', name: 'city', type: 'string', default: '' },
          { displayName: 'Default PO Number', name: 'defaultPoNumber', type: 'string', default: '' },
          { displayName: 'Default Price Class', name: 'defaultPriceClass', type: 'string', default: '' },
          { displayName: 'Default Ship Via', name: 'defaultShipVia', type: 'string', default: '' },
          { displayName: 'Default Terms', name: 'defaultTerms', type: 'string', default: '' },
          { displayName: 'Freight In Exempt', name: 'freightInExempt', type: 'boolean', default: false },
          { displayName: 'Freight Out Exempt', name: 'freightOutExempt', type: 'boolean', default: false },
          { displayName: 'Home Branch', name: 'homeBranch', type: 'string', default: '' },
          { displayName: 'Home Territory', name: 'homeTerritory', type: 'string', default: '' },
          { displayName: 'Inside Salesperson', name: 'insideSalesperson', type: 'string', default: '' },
          { displayName: 'Outside Salesperson', name: 'outsideSalesperson', type: 'string', default: '' },
          { displayName: 'Postal Code', name: 'postalCode', type: 'string', default: '', description: 'ZIP / postal code' },
          {
            displayName: 'State Code',
            name: 'state',
            type: 'string',
            default: '',
            placeholder: 'CO',
            description: '2-letter state code (e.g. CO, TX, CA)',
          },
        ],
      },
      {
        displayName: 'JSON Body',
        name: 'customJson',
        type: 'json',
        default: '{\n  "name": "string",\n  "addressLine1": "string",\n  "addressLine2": "string",\n  "city": "string",\n  "state": "string",\n  "postalCode": "string",\n  "isBillTo": false,\n  "isShipTo": true,\n  "sortBy": "string",\n  "nameIndex": "string",\n  "billToId": 123,\n  "defaultPriceClass": "string",\n  "outsideSalesperson": "string",\n  "insideSalesperson": "string",\n  "defaultPoNumber": "string",\n  "defaultShipVia": "string",\n  "freightInExempt": false,\n  "freightOutExempt": false,\n  "defaultTerms": "string",\n  "homeBranch": "string",\n  "homeTerritory": "string",\n  "types": [{"type": "string"}],\n  "shipToLists": [{"shipToId": 0}],\n  "contacts": [{"id": 0}]\n}',
        description: 'Raw JSON body to send to the API',
        displayOptions: { show: { resource: ['customer'], operation: ['create'], inputMode: ['json'] } },
      },

      // ── Update customer fields ────────────────────────────────────────────
      {
        displayName: 'Input Mode',
        name: 'inputMode',
        type: 'options',
        options: [
          { name: 'Custom JSON', value: 'json', description: 'Provide a raw JSON patch (merged on top of existing data)' },
          { name: 'Fields', value: 'fields', description: 'Fill in individual fields' },
        ],
        default: 'fields',
        displayOptions: { show: { resource: ['customer'], operation: ['update'] } },
      },
      {
        displayName: 'Clear Fields',
        name: 'clearFields',
        type: 'multiOptions',
        default: [],
        description: 'Fields to explicitly clear. Arrays are set to [], all other fields to "".',
        displayOptions: { show: { resource: ['customer'], operation: ['update'], inputMode: ['fields'] } },
        options: [
          { name: 'Address Line 1', value: 'addressLine1' },
          { name: 'Address Line 2', value: 'addressLine2' },
          { name: 'BillTo ID', value: 'billToId' },
          { name: 'City', value: 'city' },
          { name: 'Contacts', value: 'contacts' },
          { name: 'Default PO Number', value: 'defaultPoNumber' },
          { name: 'Default Price Class', value: 'defaultPriceClass' },
          { name: 'Default Ship Via', value: 'defaultShipVia' },
          { name: 'Default Terms', value: 'defaultTerms' },
          { name: 'Home Branch', value: 'homeBranch' },
          { name: 'Home Territory', value: 'homeTerritory' },
          { name: 'Inside Salesperson', value: 'insideSalesperson' },
          { name: 'Outside Salesperson', value: 'outsideSalesperson' },
          { name: 'Postal Code', value: 'postalCode' },
          { name: 'ShipTo List', value: 'shipToLists' },
          { name: 'State', value: 'state' },
          { name: 'Types', value: 'types' },
        ],
      },
      {
        displayName: 'Update Fields',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        description: 'Fields to update on the customer. Only provided fields will be overwritten.',
        displayOptions: { show: { resource: ['customer'], operation: ['update'], inputMode: ['fields'] } },
        options: [
          { displayName: 'Address Line 1', name: 'addressLine1', type: 'string', default: '' },
          { displayName: 'Address Line 2', name: 'addressLine2', type: 'string', default: '' },
          { displayName: 'BillTo ID', name: 'billToId', type: 'number', default: 0, description: 'Required when setting "Is BillTo" to false' },
          { displayName: 'City', name: 'city', type: 'string', default: '' },
          { displayName: 'Default PO Number', name: 'defaultPoNumber', type: 'string', default: '' },
          { displayName: 'Default Price Class', name: 'defaultPriceClass', type: 'string', default: '' },
          { displayName: 'Default Ship Via', name: 'defaultShipVia', type: 'string', default: '' },
          { displayName: 'Default Terms', name: 'defaultTerms', type: 'string', default: '' },
          { displayName: 'Freight In Exempt', name: 'freightInExempt', type: 'boolean', default: false },
          { displayName: 'Freight Out Exempt', name: 'freightOutExempt', type: 'boolean', default: false },
          { displayName: 'Home Branch', name: 'homeBranch', type: 'string', default: '' },
          { displayName: 'Home Territory', name: 'homeTerritory', type: 'string', default: '' },
          { displayName: 'Inside Salesperson', name: 'insideSalesperson', type: 'string', default: '' },
          { displayName: 'Is BillTo', name: 'isBillTo', type: 'boolean', default: true },
          { displayName: 'Is ShipTo', name: 'isShipTo', type: 'boolean', default: true },
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Name Index', name: 'nameIndex', type: 'string', default: '', description: 'Maximum 12 characters' },
          { displayName: 'Outside Salesperson', name: 'outsideSalesperson', type: 'string', default: '' },
          { displayName: 'Postal Code', name: 'postalCode', type: 'string', default: '' },
          { displayName: 'Sort By', name: 'sortBy', type: 'string', default: '', description: 'Maximum 12 characters' },
          {
            displayName: 'State Code',
            name: 'state',
            type: 'string',
            default: '',
            placeholder: 'CO',
            description: '2-letter state code (e.g. CO, TX, CA)',
          },
        ],
      },
      {
        displayName: 'Types',
        name: 'updateTypes',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Type',
        default: {},
        description: 'Replaces the existing customer types if any entries are provided',
        displayOptions: { show: { resource: ['customer'], operation: ['update'], inputMode: ['fields'] } },
        options: [
          {
            name: 'typeValues',
            displayName: 'Type',
            values: [{ displayName: 'Type', name: 'type', type: 'string', default: '', description: 'The customer type value (e.g. PROPANE)' }],
          },
        ],
      },
      {
        displayName: 'ShipTo List',
        name: 'updateShipToLists',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add ShipTo',
        default: {},
        description: 'Replaces the existing ship-to list if any entries are provided',
        displayOptions: { show: { resource: ['customer'], operation: ['update'], inputMode: ['fields'] } },
        options: [
          {
            name: 'shipToValues',
            displayName: 'ShipTo',
            values: [{ displayName: 'ShipTo ID', name: 'shipToId', type: 'number', default: 0 }],
          },
        ],
      },
      {
        displayName: 'Contacts',
        name: 'updateContacts',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Contact',
        default: {},
        description: 'Replaces the existing contacts if any entries are provided',
        displayOptions: { show: { resource: ['customer'], operation: ['update'], inputMode: ['fields'] } },
        options: [
          {
            name: 'contactValues',
            displayName: 'Contact',
            values: [{ displayName: 'Contact ID', name: 'id', type: 'number', default: 0 }],
          },
        ],
      },
      {
        displayName: 'JSON Patch',
        name: 'updateCustomJson',
        type: 'json',
        default: '{\n  "updateKey": "string",\n  "id": "string",\n  "name": "string",\n  "addressLine1": "string",\n  "addressLine2": "string",\n  "city": "string",\n  "state": "string",\n  "postalCode": "string",\n  "isBillTo": false,\n  "isShipTo": true,\n  "sortBy": "string",\n  "nameIndex": "string",\n  "billToId": 123,\n  "defaultPriceClass": "string",\n  "outsideSalesperson": "string",\n  "insideSalesperson": "string",\n  "defaultPoNumber": "string",\n  "defaultShipVia": "string",\n  "freightInExempt": false,\n  "freightOutExempt": false,\n  "defaultTerms": "string",\n  "homeBranch": "string",\n  "homeTerritory": "string",\n  "types": [{"type": "string"}],\n  "shipToLists": [{"shipToId": 0}],\n  "contacts": [{"id": 0}]\n}',
        description: 'Fields in this JSON are merged on top of the existing customer record',
        displayOptions: { show: { resource: ['customer'], operation: ['update'], inputMode: ['json'] } },
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
        placeholder: 'firstName,lastName,emails',
        description: 'Comma-separated list of fields to include in each result',
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
            name: 'Create',
            value: 'create',
            description: 'Create a new sales order',
            action: 'Create a sales order',
          },
          {
            name: 'Create Shipment',
            value: 'createShipment',
            description: 'Create a shipment for a sales order',
            action: 'Create a sales order shipment',
          },
          {
            name: 'Get',
            value: 'get',
            description: 'Retrieve a single sales order by ID',
            action: 'Get a sales order',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            description: 'Retrieve a list of sales orders',
            action: 'Get many sales orders',
          },
          {
            name: 'Get Order Change Log',
            value: 'getOrderChangeLog',
            description: 'Retrieve the change log for a sales order',
            action: 'Get sales order change log',
          },
          {
            name: 'Update Internal Notes',
            value: 'updateInternalNotes',
            description: 'Update internal notes on a sales order',
            action: 'Update sales order internal notes',
          },
          {
            name: 'Update PO Number',
            value: 'updatePONumber',
            description: 'Update the PO number on a sales order',
            action: 'Update sales order PO number',
          },
          {
            name: 'Update Ship Date',
            value: 'updateShipDate',
            description: 'Update the ship date on a sales order',
            action: 'Update sales order ship date',
          },
          {
            name: 'Update Ship Via',
            value: 'updateShipVia',
            description: 'Update the ship via on a sales order',
            action: 'Update sales order ship via',
          },
          {
            name: 'Update Shipping Instructions',
            value: 'updateShippingInstructions',
            description: 'Update shipping instructions on a sales order',
            action: 'Update sales order shipping instructions',
          },
          {
            name: 'Update Status',
            value: 'updateStatus',
            description: 'Update the status of a sales order',
            action: 'Update sales order status',
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
        description: 'Number of sales orders to return per page',
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
        description: 'Comma-separated list of fields to include in each result',
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
        description: 'Comma-separated list of fields to exclude from each result',
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
            displayName: 'BillTo',
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
            description: 'Whether to return only order IDs instead of full records',
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
            displayName: 'Ship Via',
            name: 'shipVia',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ship via. Separate multiple values with commas.',
          },
          {
            displayName: 'ShipTo',
            name: 'shipTo',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ship-to ID. Separate multiple values with commas.',
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
            description: 'Sort order for results',
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
        description: 'The ID of the sales order to retrieve',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['get'],
          },
        },
      },

      // ── Create Sales Order fields ─────────────────────────────────────────
      {
        displayName: 'Input Mode',
        name: 'salesOrderInputMode',
        type: 'options',
        options: [
          { name: 'Custom JSON', value: 'json', description: 'Provide a raw JSON body' },
          { name: 'Fields', value: 'fields', description: 'Fill in individual fields' },
        ],
        default: 'fields',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'] } },
      },
      {
        displayName: 'BillTo Customer ID',
        name: 'billToCustomerId',
        type: 'string',
        default: '',
        required: true,
        description: 'The ID of the bill-to customer',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'ShipTo Customer ID',
        name: 'shipToCustomerId',
        type: 'string',
        default: '',
        required: true,
        description: 'The ID of the ship-to customer',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Price Branch',
        name: 'salesOrderPriceBranch',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1',
        description: 'Home Branch of the Bill To Customer',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Ship Branch',
        name: 'salesOrderShipBranch',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1',
        description: 'Home Branch of the Bill To Customer',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Order Status',
        name: 'salesOrderStatus',
        type: 'options',
        required: true,
        options: [
          { name: 'Bid', value: 'Bid' },
          { name: 'Call When Available', value: 'CallWhenAvailable' },
          { name: 'Call When Complete', value: 'CallWhenComplete' },
          { name: 'Call When Specified', value: 'CallWhenSpecified' },
          { name: 'Direct', value: 'Direct' },
          { name: 'Pick Up Now', value: 'PickUpNow' },
          { name: 'Ship Item Complete', value: 'ShipItemComplete' },
          { name: 'Ship Ticket', value: 'ShipTicket' },
          { name: 'Ship When Available', value: 'ShipWhenAvailable' },
          { name: 'Ship When Complete', value: 'ShipWhenComplete' },
          { name: 'Ship When Specified', value: 'ShipWhenSpecified' },
        ],
        default: 'Bid',
        description: 'The status of the sales order',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Ship Date',
        name: 'salesOrderShipDate',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-07-20',
        description: 'The ship date in ISO format (YYYY-MM-DD)',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Required Date',
        name: 'salesOrderRequiredDate',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-07-25',
        description: 'The required date in ISO format (YYYY-MM-DD)',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Writer',
        name: 'salesOrderWriter',
        type: 'string',
        default: '',
        required: true,
        description: 'The writer code for the sales order',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Fetch ShipTo\'s Address',
        name: 'salesOrderFetchShipAddress',
        type: 'boolean',
        default: true,
        description: 'Whether to automatically fetch address fields (street, city, state, etc.) from the ShipTo Customer record',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'Street 1',
        name: 'salesOrderStreet1',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'], salesOrderFetchShipAddress: [false] } },
      },
      {
        displayName: 'Street 2',
        name: 'salesOrderStreet2',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'], salesOrderFetchShipAddress: [false] } },
      },
      {
        displayName: 'City',
        name: 'salesOrderCity',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'], salesOrderFetchShipAddress: [false] } },
      },
      {
        displayName: 'State',
        name: 'salesOrderState',
        type: 'string',
        default: '',
        placeholder: 'CO',
        description: '2-letter state code',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'], salesOrderFetchShipAddress: [false] } },
      },
      {
        displayName: 'Postal Code',
        name: 'salesOrderPostalCode',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'], salesOrderFetchShipAddress: [false] } },
      },
      {
        displayName: 'Country',
        name: 'salesOrderCountry',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'], salesOrderFetchShipAddress: [false] } },
      },
      {
        displayName: 'Additional Options',
        name: 'salesOrderCreateOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
        options: [
          {
            displayName: 'Customer PO Number',
            name: 'customerPONumber',
            type: 'string',
            default: '',
            description: 'Default PO Number of the BillTo Customer',
          },
          {
            displayName: 'Customer Release Number',
            name: 'customerReleaseNumber',
            type: 'string',
            default: '',
            description: 'Default Release Number of the BillTo Customer',
          },
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
            placeholder: 'name@email.com',
            default: '',
          },
          {
            displayName: 'Inside Salesperson',
            name: 'insideSalesPerson',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Internal Notes',
            name: 'internalNotes',
            type: 'string',
            typeOptions: { rows: 3 },
            default: '',
          },
          {
            displayName: 'Outside Salesperson',
            name: 'outsideSalesPerson',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Sales Source',
            name: 'salesSource',
            type: 'string',
            default: '',
            description: 'Sales Source Override of the BillTo Customer. Defaults to "Default Sales" if not provided.',
          },
          {
            displayName: 'Ship Via',
            name: 'shipVia',
            type: 'string',
            default: '',
            description: 'Default Ship Via of the BillTo Customer',
          },
          {
            displayName: 'Shipping Instructions',
            name: 'shippingInstructions',
            type: 'string',
            typeOptions: { rows: 3 },
            default: '',
          },
          {
            displayName: 'Terms Code',
            name: 'termsCode',
            type: 'string',
            default: '',
            description: 'Default Terms of the BillTo Customer',
          },
        ],
      },
      {
        displayName: 'Lines (JSON)',
        name: 'salesOrderLines',
        type: 'json',
        default: '[\n  {\n    "lineItemProduct": {\n      "productId": 246,\n      "quantity": 3,\n      "um": "ea",\n      "umQuantity": 1,\n      "unitPrice": 9.99,\n      "comments": ""\n    }\n  },\n  {\n    "lineItemProduct": {\n      "productId": 247,\n      "quantity": 3,\n      "um": "ea",\n      "umQuantity": 1\n    }\n  }\n]',
        description: 'Array of line items to add to the sales order',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['fields'] } },
      },
      {
        displayName: 'JSON Body',
        name: 'salesOrderCustomJson',
        type: 'json',
        default: '{\n  "priceBranch": 1,\n  "shipBranch": 1,\n  "billToCustomer": "12345",\n  "shipToCustomer": "12346",\n  "orderStatus": "Bid",\n  "salesSource": "Default Sales",\n  "shipDate": "2026-07-20",\n  "requiredDate": "2026-07-25",\n  "customerPONumber": "",\n  "customerReleaseNumber": "",\n  "shipVia": "",\n  "insideSalesPerson": "",\n  "outsideSalesPerson": "",\n  "writer": "",\n  "email": "",\n  "street1": "",\n  "street2": "",\n  "city": "",\n  "state": "",\n  "postalCode": "",\n  "country": "",\n  "internalNotes": "",\n  "shippingInstructions": "",\n  "termsCode": "",\n  "shipIds": ["12346"],\n  "lines": [\n    {\n      "lineItemProduct": {\n        "productId": 246,\n        "quantity": 3,\n        "um": "ea",\n        "umQuantity": 1,\n        "unitPrice": 9.99,\n        "comments": ""\n      }\n    },\n    {\n      "lineItemProduct": {\n        "productId": 247,\n        "quantity": 3,\n        "um": "ea",\n        "umQuantity": 1\n      }\n    }\n  ]\n}',
        description: 'Raw JSON body to send to the API',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['create'], salesOrderInputMode: ['json'] } },
      },

      // ── Create Shipment fields ─────────────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'shipmentSalesOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2688598',
        description: 'The ID of the sales order, without the generation',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['createShipment'],
          },
        },
      },
      {
        displayName: 'Source Generation ID',
        name: 'generationId',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1',
        description: 'The generation ID that the new generation will be based on',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['createShipment'],
          },
        },
      },
      {
        displayName: 'Required Date',
        name: 'requiredDate',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-07-25',
        description: 'The required date in ISO format (YYYY-MM-DD)',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['createShipment'],
          },
        },
      },
      {
        displayName: 'Ship Date',
        name: 'shipmentShipDate',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-07-20',
        description: 'The ship date in ISO format (YYYY-MM-DD)',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['createShipment'],
          },
        },
      },
      {
        displayName: 'Ship Branch',
        name: 'shipBranch',
        type: 'string',
        default: '',
        required: true,
        placeholder: '1',
        description: 'The branch number from which the order ships',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['createShipment'],
          },
        },
      },
      {
        displayName: 'Ship Status',
        name: 'shipStatus',
        type: 'options',
        required: true,
        options: [
          { name: 'Bid', value: 'Bid' },
          { name: 'Call When Available', value: 'CallWhenAvailable' },
          { name: 'Call When Complete', value: 'CallWhenComplete' },
          { name: 'Call When Specified', value: 'CallWhenSpecified' },
          { name: 'Direct', value: 'Direct' },
          { name: 'Pick Up Now', value: 'PickUpNow' },
          { name: 'Ship Item Complete', value: 'ShipItemComplete' },
          { name: 'Ship Ticket', value: 'ShipTicket' },
          { name: 'Ship When Available', value: 'ShipWhenAvailable' },
          { name: 'Ship When Complete', value: 'ShipWhenComplete' },
          { name: 'Ship When Specified', value: 'ShipWhenSpecified' },
        ],
        default: 'Bid',
        description: 'The ship status for the shipment',
        displayOptions: {
          show: {
            resource: ['salesOrder'],
            operation: ['createShipment'],
          },
        },
      },

      // ── Get Order Change Log fields ───────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'changeLogOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2690635',
        description: 'The ID of the sales order, without the generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['getOrderChangeLog'] } },
      },
      {
        displayName: 'Generation ID',
        name: 'changeLogGenerationId',
        type: 'string',
        default: '',
        placeholder: '1',
        description: 'Filter the change log to a specific generation. Leave blank to return all generations.',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['getOrderChangeLog'] } },
      },

      // ── Update Status fields ──────────────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'statusOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2680001.0001',
        description: 'The full sales order ID including generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateStatus'] } },
      },
      {
        displayName: 'Order Status',
        name: 'statusOrderStatus',
        type: 'options',
        required: true,
        options: [
          { name: 'Bid', value: 'Bid' },
          { name: 'Call When Available', value: 'CallWhenAvailable' },
          { name: 'Call When Complete', value: 'CallWhenComplete' },
          { name: 'Call When Specified', value: 'CallWhenSpecified' },
          { name: 'Direct', value: 'Direct' },
          { name: 'Pick Up Now', value: 'PickUpNow' },
          { name: 'Ship Item Complete', value: 'ShipItemComplete' },
          { name: 'Ship Ticket', value: 'ShipTicket' },
          { name: 'Ship When Available', value: 'ShipWhenAvailable' },
          { name: 'Ship When Complete', value: 'ShipWhenComplete' },
          { name: 'Ship When Specified', value: 'ShipWhenSpecified' },
        ],
        default: 'Bid',
        description: 'The new status for the sales order',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateStatus'] } },
      },
      {
        displayName: 'Ship Date',
        name: 'statusShipDate',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-07-20',
        description: 'The ship date in ISO format (YYYY-MM-DD). Required when Order Status is "Ship When Specified".',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateStatus'], statusOrderStatus: ['ShipWhenSpecified'] } },
      },

      // ── Update Shipping Instructions fields ───────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'shippingInstructionsOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2690635.0001',
        description: 'The full ID of the sales order including generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateShippingInstructions'] } },
      },
      {
        displayName: 'Shipping Instructions',
        name: 'shippingInstructionsValue',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateShippingInstructions'] } },
      },

      // ── Update PO Number fields ───────────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'poNumberOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2690635.0001',
        description: 'The full ID of the sales order including generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updatePONumber'] } },
      },
      {
        displayName: 'PO Number',
        name: 'poNumberValue',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updatePONumber'] } },
      },

      // ── Update Ship Via fields ────────────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'shipViaUpdateOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2690635.0001',
        description: 'The full ID of the sales order including generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateShipVia'] } },
      },
      {
        displayName: 'Ship Via',
        name: 'shipViaUpdateValue',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateShipVia'] } },
      },

      // ── Update Ship Date fields ───────────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'shipDateUpdateOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2690635.0001',
        description: 'The full ID of the sales order including generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateShipDate'] } },
      },
      {
        displayName: 'Ship Date',
        name: 'shipDateUpdateValue',
        type: 'string',
        default: '',
        required: true,
        placeholder: '2026-07-20',
        description: 'The new ship date in ISO format (YYYY-MM-DD)',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateShipDate'] } },
      },

      // ── Update Internal Notes fields ──────────────────────────────────────
      {
        displayName: 'Sales Order ID',
        name: 'internalNotesOrderId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'S2680001.0001',
        description: 'The full sales order ID including generation suffix',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateInternalNotes'] } },
      },
      {
        displayName: 'Internal Notes',
        name: 'internalNotesValue',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateInternalNotes'] } },
      },
      {
        displayName: 'Copy To All Generations',
        name: 'copyToAll',
        type: 'boolean',
        default: false,
        description: 'Whether to apply the update to all generations of the order',
        displayOptions: { show: { resource: ['salesOrder'], operation: ['updateInternalNotes'] } },
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

    const resource = (this.getNodeParameter('resource', 0) as string).trim();
    const operation = (this.getNodeParameter('operation', 0) as string).trim();

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
            const fieldsFilterMode = (this.getNodeParameter('fieldsFilterMode', i) as string).trim();

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
            const contactId = (this.getNodeParameter('contactId', i) as string).trim();

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
            const fieldsFilterMode = (this.getNodeParameter('fieldsFilterMode', i) as string).trim();

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
            const recordId = (this.getNodeParameter(idParam, i) as string).trim();

            const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/${endpoint}`,
              headers,
              qs: { id: recordId, includeTotalItems: 'true' },
            });

            returnData.push({ json: response, pairedItem: { item: i } });
          }
        }

        // ── CREATE CUSTOMER ────────────────────────────────────────────────
        if (resource === 'customer' && operation === 'create') {
          const inputMode = (this.getNodeParameter('inputMode', i) as string).trim();
          let body: JsonObject;

          if (inputMode === 'json') {
            const rawJson = (this.getNodeParameter('customJson', i) as string).trim();
            body = JSON.parse(rawJson) as JsonObject;
          } else {
            const name = (this.getNodeParameter('name', i) as string).trim();
            const isBillTo = this.getNodeParameter('isBillTo', i) as boolean;
            const isShipTo = this.getNodeParameter('isShipTo', i) as boolean;
            const sortBy = (this.getNodeParameter('sortBy', i) as string).trim();
            const nameIndex = (this.getNodeParameter('nameIndex', i) as string).trim();
            const additionalFields = this.getNodeParameter('additionalFields', i) as {
              addressLine1?: string;
              addressLine2?: string;
              city?: string;
              state?: string;
              postalCode?: string;
              defaultPriceClass?: string;
              outsideSalesperson?: string;
              insideSalesperson?: string;
              defaultPoNumber?: string;
              defaultShipVia?: string;
              freightInExempt?: boolean;
              freightOutExempt?: boolean;
              defaultTerms?: string;
              homeBranch?: string;
              homeTerritory?: string;
            };
            const typesParam = this.getNodeParameter('types', i) as { typeValues?: Array<{ type: string }> };
            const shipToListsParam = this.getNodeParameter('shipToLists', i) as { shipToValues?: Array<{ shipToId: number }> };
            const contactsParam = this.getNodeParameter('contacts', i) as { contactValues?: Array<{ id: number }> };

            body = { name, isBillTo, isShipTo, sortBy, nameIndex };

            if (!isBillTo) body.billToId = this.getNodeParameter('billToId', i) as number;

            if (additionalFields.addressLine1) body.addressLine1 = additionalFields.addressLine1;
            if (additionalFields.addressLine2) body.addressLine2 = additionalFields.addressLine2;
            if (additionalFields.city) body.city = additionalFields.city;
            if (additionalFields.state) body.state = additionalFields.state;
            if (additionalFields.postalCode) body.postalCode = additionalFields.postalCode;
            if (additionalFields.defaultPriceClass) body.defaultPriceClass = additionalFields.defaultPriceClass;
            if (additionalFields.outsideSalesperson) body.outsideSalesperson = additionalFields.outsideSalesperson;
            if (additionalFields.insideSalesperson) body.insideSalesperson = additionalFields.insideSalesperson;
            if (additionalFields.defaultPoNumber) body.defaultPoNumber = additionalFields.defaultPoNumber;
            if (additionalFields.defaultShipVia) body.defaultShipVia = additionalFields.defaultShipVia;
            if (additionalFields.freightInExempt !== undefined) body.freightInExempt = additionalFields.freightInExempt;
            if (additionalFields.freightOutExempt !== undefined) body.freightOutExempt = additionalFields.freightOutExempt;
            if (additionalFields.defaultTerms) body.defaultTerms = additionalFields.defaultTerms;
            if (additionalFields.homeBranch) body.homeBranch = additionalFields.homeBranch;
            if (additionalFields.homeTerritory) body.homeTerritory = additionalFields.homeTerritory;

            const types = typesParam.typeValues ?? [];
            if (types.length > 0) body.types = types;

            const shipToLists = (shipToListsParam.shipToValues ?? []).map(({ shipToId }) => ({ shipToId }));
            if (shipToLists.length > 0) body.shipToLists = shipToLists;

            const contactsList = (contactsParam.contactValues ?? []).map(({ id }) => ({ id }));
            if (contactsList.length > 0) body.contacts = contactsList;
          }

          const createResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
            method: 'POST',
            url: `${baseUrl}/Customers`,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body,
            json: true,
            returnFullResponse: true,
            ignoreHttpStatusErrors: true,
          });

          if (createResponse.statusCode < 200 || createResponse.statusCode >= 300) {
            throw new NodeApiError(this.getNode(), {
              message: `Create customer failed with status ${createResponse.statusCode}`,
              description: typeof createResponse.body === 'object'
                ? JSON.stringify(createResponse.body)
                : String(createResponse.body),
            } as JsonObject, { itemIndex: i });
          }

          returnData.push({ json: createResponse.body as JsonObject, pairedItem: { item: i } });
        }

        // ── UPDATE CUSTOMER ────────────────────────────────────────────────
        if (resource === 'customer' && operation === 'update') {
          const customerId = (this.getNodeParameter('customerId', i) as string).trim();
          const inputMode = (this.getNodeParameter('inputMode', i) as string).trim();

          const existing = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
            method: 'GET',
            url: `${baseUrl}/Customers/${customerId}`,
            headers,
          });

          let body: JsonObject = { ...(existing as JsonObject) };

          if (inputMode === 'json') {
            const rawJson = (this.getNodeParameter('updateCustomJson', i) as string).trim();
            body = { ...body, ...(JSON.parse(rawJson) as JsonObject) };
          } else {
            const updateFields = this.getNodeParameter('updateFields', i) as {
              name?: string;
              addressLine1?: string;
              addressLine2?: string;
              city?: string;
              state?: string;
              postalCode?: string;
              isBillTo?: boolean;
              isShipTo?: boolean;
              sortBy?: string;
              nameIndex?: string;
              defaultPriceClass?: string;
              billToId?: number;
              outsideSalesperson?: string;
              insideSalesperson?: string;
              defaultPoNumber?: string;
              defaultShipVia?: string;
              freightInExempt?: boolean;
              freightOutExempt?: boolean;
              defaultTerms?: string;
              homeBranch?: string;
              homeTerritory?: string;
            };
            const typesParam = this.getNodeParameter('updateTypes', i) as { typeValues?: Array<{ type: string }> };
            const shipToListsParam = this.getNodeParameter('updateShipToLists', i) as { shipToValues?: Array<{ shipToId: number }> };
            const contactsParam = this.getNodeParameter('updateContacts', i) as { contactValues?: Array<{ id: number }> };

            if (updateFields.name !== undefined && updateFields.name !== '') body.name = updateFields.name;
            if (updateFields.addressLine1 !== undefined && updateFields.addressLine1 !== '') body.addressLine1 = updateFields.addressLine1;
            if (updateFields.addressLine2 !== undefined && updateFields.addressLine2 !== '') body.addressLine2 = updateFields.addressLine2;
            if (updateFields.city !== undefined && updateFields.city !== '') body.city = updateFields.city;
            if (updateFields.state !== undefined && updateFields.state !== '') body.state = updateFields.state;
            if (updateFields.postalCode !== undefined && updateFields.postalCode !== '') body.postalCode = updateFields.postalCode;
            if (updateFields.isBillTo !== undefined) body.isBillTo = updateFields.isBillTo;
            if (updateFields.isShipTo !== undefined) body.isShipTo = updateFields.isShipTo;
            if (updateFields.sortBy !== undefined && updateFields.sortBy !== '') body.sortBy = updateFields.sortBy;
            if (updateFields.nameIndex !== undefined && updateFields.nameIndex !== '') body.nameIndex = updateFields.nameIndex;
            if (updateFields.defaultPriceClass !== undefined && updateFields.defaultPriceClass !== '') body.defaultPriceClass = updateFields.defaultPriceClass;
            if (updateFields.billToId !== undefined && updateFields.billToId !== 0) body.billToId = updateFields.billToId;
            if (updateFields.outsideSalesperson !== undefined && updateFields.outsideSalesperson !== '') body.outsideSalesperson = updateFields.outsideSalesperson;
            if (updateFields.insideSalesperson !== undefined && updateFields.insideSalesperson !== '') body.insideSalesperson = updateFields.insideSalesperson;
            if (updateFields.defaultPoNumber !== undefined && updateFields.defaultPoNumber !== '') body.defaultPoNumber = updateFields.defaultPoNumber;
            if (updateFields.defaultShipVia !== undefined && updateFields.defaultShipVia !== '') body.defaultShipVia = updateFields.defaultShipVia;
            if (updateFields.freightInExempt !== undefined) body.freightInExempt = updateFields.freightInExempt;
            if (updateFields.freightOutExempt !== undefined) body.freightOutExempt = updateFields.freightOutExempt;
            if (updateFields.defaultTerms !== undefined && updateFields.defaultTerms !== '') body.defaultTerms = updateFields.defaultTerms;
            if (updateFields.homeBranch !== undefined && updateFields.homeBranch !== '') body.homeBranch = updateFields.homeBranch;
            if (updateFields.homeTerritory !== undefined && updateFields.homeTerritory !== '') body.homeTerritory = updateFields.homeTerritory;

            const types = typesParam.typeValues ?? [];
            if (types.length > 0) body.types = types;

            const shipToLists = (shipToListsParam.shipToValues ?? []).map(({ shipToId }) => ({ shipToId }));
            if (shipToLists.length > 0) body.shipToLists = shipToLists;

            const contactsList = (contactsParam.contactValues ?? []).map(({ id }) => ({ id }));
            if (contactsList.length > 0) body.contacts = contactsList;

            const arrayFields = new Set(['types', 'shipToLists', 'contacts']);
            const clearFields = this.getNodeParameter('clearFields', i) as string[];
            for (const field of clearFields) {
              body[field] = arrayFields.has(field) ? [] : '';
            }
          }

          const updateResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
            method: 'PUT',
            url: `${baseUrl}/Customers/${customerId}`,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body,
            json: true,
            returnFullResponse: true,
            ignoreHttpStatusErrors: true,
          });

          if (updateResponse.statusCode < 200 || updateResponse.statusCode >= 300) {
            throw new NodeApiError(this.getNode(), {
              message: `Update customer failed with status ${updateResponse.statusCode}`,
              description: typeof updateResponse.body === 'object'
                ? JSON.stringify(updateResponse.body)
                : String(updateResponse.body),
            } as JsonObject, { itemIndex: i });
          }

          returnData.push({ json: updateResponse.body as JsonObject, pairedItem: { item: i } });
        }

        if (resource === 'salesOrder') {

          // ── GET MANY ────────────────────────────────────────────────────
          if (operation === 'getMany') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i) as number;
            const fieldsFilterMode = (this.getNodeParameter('fieldsFilterMode', i) as string).trim();

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
            const salesOrderId = (this.getNodeParameter('salesOrderId', i) as string).trim();

            const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/SalesOrders`,
              headers,
              qs: { id: salesOrderId, includeTotalItems: 'true' },
            });

            returnData.push({ json: response, pairedItem: { item: i } });
          }

          // ── CREATE SALES ORDER ──────────────────────────────────────────
          if (operation === 'create') {
            const inputMode = (this.getNodeParameter('salesOrderInputMode', i) as string).trim();
            let body: JsonObject;

            if (inputMode === 'json') {
              const rawJson = (this.getNodeParameter('salesOrderCustomJson', i) as string).trim();
              body = JSON.parse(rawJson) as JsonObject;
            } else {
              const billToCustomerId = (this.getNodeParameter('billToCustomerId', i) as string).trim();
              const shipToCustomerId = (this.getNodeParameter('shipToCustomerId', i) as string).trim();
              const priceBranch = (this.getNodeParameter('salesOrderPriceBranch', i) as string).trim();
              const shipBranch = (this.getNodeParameter('salesOrderShipBranch', i) as string).trim();
              const orderStatus = (this.getNodeParameter('salesOrderStatus', i) as string).trim();
              const shipDate = (this.getNodeParameter('salesOrderShipDate', i) as string).trim();
              const requiredDate = (this.getNodeParameter('salesOrderRequiredDate', i) as string).trim();
              const writer = (this.getNodeParameter('salesOrderWriter', i) as string).trim();
              const fetchShipAddress = this.getNodeParameter('salesOrderFetchShipAddress', i) as boolean;
              const options = this.getNodeParameter('salesOrderCreateOptions', i) as {
                salesSource?: string;
                customerPONumber?: string;
                customerReleaseNumber?: string;
                shipVia?: string;
                insideSalesPerson?: string;
                outsideSalesPerson?: string;
                email?: string;
                internalNotes?: string;
                shippingInstructions?: string;
                termsCode?: string;
              };
              const linesJson = (this.getNodeParameter('salesOrderLines', i) as string).trim();

              let street1 = '', street2 = '', city = '', state = '', postalCode = '', country = '';

              if (fetchShipAddress) {
                const shipCustomer = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                  method: 'GET',
                  url: `${baseUrl}/Customers/${shipToCustomerId}`,
                  headers,
                }) as JsonObject;
                street1 = (shipCustomer.addressLine1 as string | undefined) ?? '';
                street2 = (shipCustomer.addressLine2 as string | undefined) ?? '';
                city = (shipCustomer.city as string | undefined) ?? '';
                state = (shipCustomer.state as string | undefined) ?? '';
                postalCode = (shipCustomer.postalCode as string | undefined) ?? '';
                country = (shipCustomer.countryCode as string | undefined) ?? '';
              } else {
                street1 = (this.getNodeParameter('salesOrderStreet1', i) as string).trim();
                street2 = (this.getNodeParameter('salesOrderStreet2', i) as string).trim();
                city = (this.getNodeParameter('salesOrderCity', i) as string).trim();
                state = (this.getNodeParameter('salesOrderState', i) as string).trim();
                postalCode = (this.getNodeParameter('salesOrderPostalCode', i) as string).trim();
                country = (this.getNodeParameter('salesOrderCountry', i) as string).trim();
              }

              body = {
                priceBranch,
                shipBranch,
                billToCustomer: billToCustomerId,
                shipToCustomer: shipToCustomerId,
                orderStatus,
                shipDate,
                requiredDate,
                writer,
                street1,
                street2,
                city,
                state,
                postalCode,
                country,
                shipIds: [shipToCustomerId],
              };

              if (options.salesSource?.trim()) body.salesSource = options.salesSource.trim();
              if (options.customerPONumber?.trim()) body.customerPONumber = options.customerPONumber.trim();
              if (options.customerReleaseNumber?.trim()) body.customerReleaseNumber = options.customerReleaseNumber.trim();
              if (options.shipVia?.trim()) body.shipVia = options.shipVia.trim();
              if (options.insideSalesPerson?.trim()) body.insideSalesPerson = options.insideSalesPerson.trim();
              if (options.outsideSalesPerson?.trim()) body.outsideSalesPerson = options.outsideSalesPerson.trim();
              if (options.email?.trim()) body.email = options.email.trim();
              if (options.internalNotes?.trim()) body.internalNotes = options.internalNotes.trim();
              if (options.shippingInstructions?.trim()) body.shippingInstructions = options.shippingInstructions.trim();
              if (options.termsCode?.trim()) body.termsCode = options.termsCode.trim();

              if (linesJson) body.lines = JSON.parse(linesJson) as JsonObject[];
            }

            const createResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'POST',
              url: `${baseUrl}/SalesOrders`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (createResponse.statusCode < 200 || createResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Create sales order failed with status ${createResponse.statusCode}`,
                description: typeof createResponse.body === 'object'
                  ? JSON.stringify(createResponse.body)
                  : String(createResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: createResponse.body as JsonObject, pairedItem: { item: i } });
          }

          // ── CREATE SHIPMENT ──────────────────────────────────────────────
          if (operation === 'createShipment') {
            const salesOrderId = (this.getNodeParameter('shipmentSalesOrderId', i) as string).trim();
            const generationId = (this.getNodeParameter('generationId', i) as string).trim();
            const requiredDate = (this.getNodeParameter('requiredDate', i) as string).trim();
            const shipDate = (this.getNodeParameter('shipmentShipDate', i) as string).trim();
            const shipBranch = (this.getNodeParameter('shipBranch', i) as string).trim();
            const shipStatus = (this.getNodeParameter('shipStatus', i) as string).trim();

            const shipmentResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'POST',
              url: `${baseUrl}/SalesOrders/${salesOrderId}/Shipment`,
              headers,
              qs: { generationId, requiredDate, shipDate, shipBranch, shipStatus },
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (shipmentResponse.statusCode < 200 || shipmentResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Create shipment failed with status ${shipmentResponse.statusCode}`,
                description: typeof shipmentResponse.body === 'object'
                  ? JSON.stringify(shipmentResponse.body)
                  : String(shipmentResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: shipmentResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── GET ORDER CHANGE LOG ─────────────────────────────────────────
          if (operation === 'getOrderChangeLog') {
            const orderId = (this.getNodeParameter('changeLogOrderId', i) as string).trim();
            const generationId = (this.getNodeParameter('changeLogGenerationId', i) as string).trim();

            const qs: Record<string, string> = {};
            if (generationId) qs.generationId = generationId;

            const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/SalesOrders/${orderId}/OrderChangeLog`,
              headers,
              qs,
            });

            returnData.push({ json: response as JsonObject, pairedItem: { item: i } });
          }

          // ── UPDATE STATUS ────────────────────────────────────────────────
          if (operation === 'updateStatus') {
            const rawStatusId = (this.getNodeParameter('statusOrderId', i) as string).trim();
            const orderStatus = (this.getNodeParameter('statusOrderStatus', i) as string).trim();
            const shipDate = orderStatus === 'ShipWhenSpecified'
              ? (this.getNodeParameter('statusShipDate', i) as string).trim()
              : undefined;

            const statusDotIndex = rawStatusId.indexOf('.');
            const orderId = statusDotIndex !== -1 ? rawStatusId.slice(0, statusDotIndex) : rawStatusId;
            const generationId = statusDotIndex !== -1 ? rawStatusId.slice(statusDotIndex + 1).padStart(4, '0') : '';

            const statusBody: JsonObject = { generationId, orderStatus };
            if (shipDate) statusBody.shipDate = shipDate;

            const statusResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/Status`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: statusBody,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (statusResponse.statusCode < 200 || statusResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update status failed with status ${statusResponse.statusCode}`,
                description: typeof statusResponse.body === 'object'
                  ? JSON.stringify(statusResponse.body)
                  : String(statusResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: statusResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE SHIPPING INSTRUCTIONS ─────────────────────────────────
          if (operation === 'updateShippingInstructions') {
            const orderId = (this.getNodeParameter('shippingInstructionsOrderId', i) as string).trim();
            const value = (this.getNodeParameter('shippingInstructionsValue', i) as string).trim();

            const siResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/Header/ShippingInstructions`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify(value),
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (siResponse.statusCode < 200 || siResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update shipping instructions failed with status ${siResponse.statusCode}`,
                description: typeof siResponse.body === 'object'
                  ? JSON.stringify(siResponse.body)
                  : String(siResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: siResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE PO NUMBER ─────────────────────────────────────────────
          if (operation === 'updatePONumber') {
            const orderId = (this.getNodeParameter('poNumberOrderId', i) as string).trim();
            const poNumber = (this.getNodeParameter('poNumberValue', i) as string).trim();

            const poResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/Header/PONumber`,
              headers,
              qs: { PONumber: poNumber },
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (poResponse.statusCode < 200 || poResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update PO number failed with status ${poResponse.statusCode}`,
                description: typeof poResponse.body === 'object'
                  ? JSON.stringify(poResponse.body)
                  : String(poResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: poResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE SHIP VIA ──────────────────────────────────────────────
          if (operation === 'updateShipVia') {
            const orderId = (this.getNodeParameter('shipViaUpdateOrderId', i) as string).trim();
            const shipVia = (this.getNodeParameter('shipViaUpdateValue', i) as string).trim();

            const svResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/ShipVia`,
              headers,
              qs: { shipVia },
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (svResponse.statusCode < 200 || svResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update ship via failed with status ${svResponse.statusCode}`,
                description: typeof svResponse.body === 'object'
                  ? JSON.stringify(svResponse.body)
                  : String(svResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: svResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE SHIP DATE ─────────────────────────────────────────────
          if (operation === 'updateShipDate') {
            const orderId = (this.getNodeParameter('shipDateUpdateOrderId', i) as string).trim();
            const shipDate = (this.getNodeParameter('shipDateUpdateValue', i) as string).trim();

            const sdResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/ShipDate`,
              headers,
              qs: { shipDate },
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (sdResponse.statusCode < 200 || sdResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update ship date failed with status ${sdResponse.statusCode}`,
                description: typeof sdResponse.body === 'object'
                  ? JSON.stringify(sdResponse.body)
                  : String(sdResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: sdResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE INTERNAL NOTES ────────────────────────────────────────
          if (operation === 'updateInternalNotes') {
            const rawId = (this.getNodeParameter('internalNotesOrderId', i) as string).trim();
            const copyToAll = this.getNodeParameter('copyToAll', i) as boolean;
            const internalNotes = (this.getNodeParameter('internalNotesValue', i) as string).trim();

            const dotIndex = rawId.indexOf('.');
            const orderId = dotIndex !== -1 ? rawId.slice(0, dotIndex) : rawId;
            const genId = dotIndex !== -1 ? rawId.slice(dotIndex + 1).padStart(4, '0') : '';
            const fullId = `${orderId}.${genId}`;
            const putQs = copyToAll ? { copyToAll: true } : {};

            const getResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/SalesOrders/${fullId}/InternalNotes`,
              headers,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (getResponse.statusCode < 200 || getResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `GET internal notes failed with status ${getResponse.statusCode}`,
                description: typeof getResponse.body === 'object'
                  ? JSON.stringify(getResponse.body)
                  : String(getResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            const existing = getResponse.body as JsonObject;
            const updateKey = (existing.updateKey ?? '') as string;
            if (!updateKey) {
              throw new NodeApiError(this.getNode(), {
                message: 'Could not find updateKey in GET response',
                description: JSON.stringify(existing),
              } as JsonObject, { itemIndex: i });
            }
            const body: JsonObject = {
              id: orderId,
              generationId: genId,
              internalNotes,
              updateKey,
            };

            const inResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${fullId}/InternalNotes`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              qs: putQs,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (inResponse.statusCode < 200 || inResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update internal notes failed with status ${inResponse.statusCode}`,
                description: typeof inResponse.body === 'object'
                  ? JSON.stringify(inResponse.body)
                  : String(inResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: inResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }
        }

        if (resource === 'product' && operation === 'getProductInventoryPricingInquiry') {
          const customerId = (this.getNodeParameter('pricingCustomerId', i) as string).trim();
          const productId = (this.getNodeParameter('pricingProductId', i) as string).trim();
          const considerUserAuthBranch = this.getNodeParameter('considerUserAuthBranch', i) as boolean;
          const userId = considerUserAuthBranch ? (this.getNodeParameter('pricingUserId', i) as string).trim() : undefined;

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
        throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
      }
    }

    return [returnData];
  }
}
