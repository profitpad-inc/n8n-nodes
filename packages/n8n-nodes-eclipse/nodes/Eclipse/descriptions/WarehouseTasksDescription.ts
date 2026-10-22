import { INodeProperties } from 'n8n-workflow';

export const warehouseTasksDescription: INodeProperties[] = [
  // ── Warehouse Tasks operations ────────────────────────────────────────
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
      },
    },
    options: [
      {
        name: 'Get Printer Forms',
        value: 'getPrinterForms',
        description: 'Get the available printer forms',
        action: 'Get printer forms',
      },
      {
        name: 'Get Printer Locations',
        value: 'getPrinterLocations',
        description: 'Get the available printer locations',
        action: 'Get printer locations',
      },
      {
        name: 'Get PutAway Tote',
        value: 'getPutAwayTote',
        description: 'Get the put away tote for a user at a branch',
        action: 'Get put away tote',
      },
      {
        name: 'Get User PutAway Tasks',
        value: 'getUserPutAway',
        description: 'Get the put away tasks for a user at a branch',
        action: 'Get user put away tasks',
      },
      {
        name: 'Get Warehouse System Settings',
        value: 'getWarehouseSystemSettings',
        description: 'Get the warehouse system settings',
        action: 'Get warehouse system settings',
      },
      {
        name: 'Parse 2D Barcode',
        value: 'parse2DBarcode',
        description: 'Parse a 2D barcode string',
        action: 'Parse 2D barcode',
      },
      {
        name: 'Print Ticket',
        value: 'printTicket',
        description: 'Print a ticket for a sales order',
        action: 'Print ticket',
      },
    ],
    default: 'getPrinterForms',
  },

  // ── Get Printer Forms ─────────────────────────────────────────────────
  {
    displayName: 'Location',
    name: 'printerFormsLocation',
    type: 'string',
    default: '',
    required: true,
    description: 'The printer location to get forms for',
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['getPrinterForms'],
      },
    },
  },
  {
    displayName: 'Form Options',
    name: 'printerFormsOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['getPrinterForms'],
      },
    },
    options: [
      {
        displayName: 'Form',
        name: 'form',
        type: 'string',
        default: '',
        placeholder: 'form1,form2',
        description: 'Only return these forms. Accepts a comma-separated list, or an array via expression.',
      },
      {
        displayName: 'Search In Forms Loaded',
        name: 'searchInFormsLoaded',
        type: 'boolean',
        default: false,
        description: 'Whether to set SearchInFormsLoaded on the request. Requires Form.',
      },
    ],
  },

  // ── Get Printer Locations ─────────────────────────────────────────────
  {
    displayName: 'Additional Options',
    name: 'additionalOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['getPrinterLocations'],
      },
    },
    options: [
      {
        displayName: 'Branch',
        name: 'branch',
        type: 'string',
        default: '',
        description: 'Only return printer locations for this branch',
      },
    ],
  },

  // ── Parse 2D Barcode ──────────────────────────────────────────────────
  {
    displayName: 'Barcode String',
    name: 'barcodeString',
    type: 'string',
    default: '',
    required: true,
    description: 'The 2D barcode string to parse',
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['parse2DBarcode'],
      },
    },
  },

  // ── Get PutAway Tote / Get User PutAway Tasks ─────────────────────────
  {
    displayName: 'Branch ID',
    name: 'branchId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the branch',
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['getPutAwayTote', 'getUserPutAway'],
      },
    },
  },
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'string',
    default: '',
    required: true,
    description: 'The ID of the user',
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['getPutAwayTote', 'getUserPutAway'],
      },
    },
  },

  // ── Print Ticket ──────────────────────────────────────────────────────
  {
    displayName: 'Sales Order ID',
    name: 'printSalesOrderId',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'S2681000.0001',
    description: 'The ID of the sales order to print a ticket for. Sent in both the URL and the request body.',
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['printTicket'],
      },
    },
  },
  {
    displayName: 'Printer ID',
    name: 'printerId',
    type: 'string',
    default: '',
    required: true,
    placeholder: '1',
    description: 'The ID of the printer to print to',
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['printTicket'],
      },
    },
  },
  {
    displayName: 'Additional Fields',
    name: 'printAdditionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['warehouseTasks'],
        operation: ['printTicket'],
      },
    },
    options: [
      {
        displayName: 'Print Ticket Flag',
        name: 'printTicketFlag',
        type: 'boolean',
        default: true,
        description: 'Whether to print the ticket',
      },
      {
        displayName: 'Printer Format',
        name: 'printerFormat',
        type: 'string',
        default: '',
        description: 'The printer format to use',
      },
      {
        displayName: 'Skip Printer Form Validation',
        name: 'skipPrinterFormValidation',
        type: 'boolean',
        default: true,
        description: 'Whether to skip printer form validation',
      },
    ],
  },
];
