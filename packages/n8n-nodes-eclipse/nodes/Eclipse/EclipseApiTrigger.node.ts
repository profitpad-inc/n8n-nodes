import {
  IPollFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
  NodeConnectionTypes,
} from 'n8n-workflow';

import { applyFieldFilter, createSession, withRetry } from './helpers';

export class EclipseApiTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Epicor Eclipse Trigger',
    name: 'eclipseApiTrigger',
    icon: 'file:eclipse-icon.svg',
    group: ['trigger'],
    version: 1,
    description: 'Polls for new or updated Epicor Eclipse records on a schedule.',
    subtitle: '={{$parameter["resource"]}}',
    defaults: {
      name: 'Eclipse Trigger',
    },
    polling: true,
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'eclipseApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Contact', value: 'contact' },
          { name: 'Customer', value: 'customer' },
          { name: 'Product', value: 'product' },
          { name: 'Sales Order', value: 'salesOrder' },
        ],
        default: 'customer',
      },
      {
        displayName: 'Lookback Window',
        name: 'pollInterval',
        type: 'options',
        // eslint-disable-next-line @n8n/community-nodes/options-sorted-alphabetically
        options: [
          { name: '1 Minute', value: 1 },
          { name: '5 Minutes', value: 5 },
          { name: '30 Minutes', value: 30 },
          { name: '1 Hour', value: 60 },
          { name: '4 Hours', value: 240 },
          { name: '24 Hours', value: 1440 },
          { name: 'Custom Date', value: 'custom' },
        ],
        default: 5,
        description: 'How far back to look for updated records on each poll, in minutes. Any decimal values will be rounded up to the nearest minute.',
      },
      {
        displayName: 'Updated After',
        name: 'updatedAfter',
        type: 'dateTime',
        default: '',
        required: true,
        description: 'Only return records updated after this date and time. Timezone is always UTC.',
        displayOptions: {
          show: {
            pollInterval: ['custom'],
          },
        },
      },
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
      },
      {
        displayName: 'Page Size',
        name: 'pageSize',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 10,
        description: 'Number of results to return per page',
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
            fieldsFilterMode: ['except'],
          },
        },
      },

      // ── Customer / Contact / Product filters ──────────────────────────────
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['customer', 'contact', 'product'],
          },
        },
        options: [
          {
            displayName: 'ID',
            name: 'id',
            type: 'string',
            default: '',
            placeholder: '123 or 123,456,789',
            description: 'Filter by ID. Separate multiple IDs with commas.',
          },
          {
            displayName: 'Keyword',
            name: 'keyword',
            type: 'string',
            default: '',
            description: 'Filter results by keyword search',
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

      // ── Sales Order filters ───────────────────────────────────────────────
      {
        displayName: 'Date Filter Options',
        name: 'dateFilterOptions',
        type: 'collection',
        placeholder: 'Add Date Filter',
        default: {},
        displayOptions: {
          show: {
            resource: ['salesOrder'],
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
        name: 'salesOrderAdditionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            resource: ['salesOrder'],
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
            default: '+LastModifiedDateAndTimeStamp',
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
    ],
		usableAsTool: true,
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const credentials = await this.getCredentials('eclipseApi');
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    const username = credentials.username as string;
    const password = credentials.password as string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionToken = await createSession(this as any, baseUrl, username, password);
    const headers = { Accept: 'application/json', sessionToken };

    const resource = this.getNodeParameter('resource') as string;
    const pollInterval = this.getNodeParameter('pollInterval') as number | string;
    const returnAll = this.getNodeParameter('returnAll') as boolean;
    const pageSize = this.getNodeParameter('pageSize') as number;
    const fieldsFilterMode = (this.getNodeParameter('fieldsFilterMode') as string).trim();
    const fieldsToInclude = fieldsFilterMode === 'selected' ? (this.getNodeParameter('fieldsToInclude') as string) : '';
    const fieldsToExclude = fieldsFilterMode === 'except' ? (this.getNodeParameter('fieldsToExclude') as string) : '';

    // Determine the lookback timestamp:
    //  1. Custom Date mode: use the top-level updatedAfter field directly.
    //  2. Otherwise, use the timestamp from the last successful poll.
    //  3. On first ever run, fall back to now minus pollInterval minutes.
    const workflowStaticData = this.getWorkflowStaticData('node');
    let lookbackTime: string;

    if (pollInterval === 'custom') {
      lookbackTime = this.getNodeParameter('updatedAfter') as string;
    } else {
      const intervalLookback = new Date(Date.now() - Math.ceil(pollInterval as number) * 60 * 1000).toISOString();
      const lastRun = workflowStaticData.lastRunTime as string | undefined;
      // Use whichever is earlier: the configured interval lookback, or lastRunTime.
      // Normally these are the same (lastRunTime ≈ now - interval). If lastRunTime is
      // more recent (e.g. from a shorter prior run), the interval wins so we always
      // look back at least the configured window. If the workflow was off longer than
      // the interval, lastRunTime wins so we resume from where we left off.
      lookbackTime = lastRun && lastRun < intervalLookback ? lastRun : intervalLookback;
    }

    // Capture current time before the request so we don't miss records
    // that arrive between query execution and the next poll.
    const currentRunTime = new Date().toISOString();

    const splitParam = (val: string | undefined): string[] =>
      val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

    let buildUrl: (startIndex: number) => string;
    let defaultStartIndex: number;

    if (resource === 'salesOrder') {
      const soOptions = this.getNodeParameter('salesOrderAdditionalOptions') as {
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
      const dfOptions = this.getNodeParameter('dateFilterOptions') as {
        lastModifiedDateAndTimeStampEnd?: string;
        orderDateStart?: string;
        orderDateEnd?: string;
        shipDateStart?: string;
        shipDateEnd?: string;
      };

      defaultStartIndex = soOptions.startIndex ?? 1;

      buildUrl = (startIndex: number): string => {
        const params = new URLSearchParams();
        params.set('pageSize', String(pageSize));
        params.set('startIndex', String(startIndex));
        params.set('includeTotalItems', 'true');
        params.set('LastModifiedDateAndTimeStampStart', lookbackTime);
        for (const v of splitParam(soOptions.id)) params.append('id', v);
        for (const v of splitParam(soOptions.billTo)) params.append('BillTo', v);
        for (const v of splitParam(soOptions.shipTo)) params.append('ShipTo', v);
        for (const v of splitParam(soOptions.shipBranch)) params.append('ShipBranch', v);
        for (const v of splitParam(soOptions.priceBranch)) params.append('PriceBranch', v);
        for (const v of splitParam(soOptions.shipVia)) params.append('ShipVia', v);
        for (const v of splitParam(soOptions.insideSalesperson)) params.append('InsideSalesperson', v);
        for (const v of splitParam(soOptions.outsideSalesperson)) params.append('OutsideSalesperson', v);
        for (const v of splitParam(soOptions.writer)) params.append('Writer', v);
        for (const v of (soOptions.orderStatus ?? [])) params.append('OrderStatus', v);
        if (dfOptions.lastModifiedDateAndTimeStampEnd) params.set('LastModifiedDateAndTimeStampEnd', dfOptions.lastModifiedDateAndTimeStampEnd);
        if (dfOptions.orderDateStart) params.set('OrderDateStart', dfOptions.orderDateStart);
        if (dfOptions.orderDateEnd) params.set('OrderDateEnd', dfOptions.orderDateEnd);
        if (dfOptions.shipDateStart) params.set('ShipDateStart', dfOptions.shipDateStart);
        if (dfOptions.shipDateEnd) params.set('ShipDateEnd', dfOptions.shipDateEnd);
        if (soOptions.onlyIds) params.set('onlyIds', 'true');
        if (soOptions.sort) params.set('sort', soOptions.sort);
        return `${baseUrl}/SalesOrders?${params.toString()}`;
      };
    } else {
      const endpointMap: Record<string, string> = {
        customer: 'Customers',
        contact: 'Contacts',
        product: 'Products',
      };
      const endpoint = endpointMap[resource];
      const additionalOptions = this.getNodeParameter('additionalOptions') as {
        keyword?: string;
        startIndex?: number;
        id?: string;
      };
      const ids = splitParam(additionalOptions.id);
      defaultStartIndex = additionalOptions.startIndex ?? 1;

      buildUrl = (startIndex: number): string => {
        const params = new URLSearchParams();
        params.set('pageSize', String(pageSize));
        params.set('startIndex', String(startIndex));
        params.set('includeTotalItems', 'true');
        params.set('updatedAfter', lookbackTime);
        for (const id of ids) params.append('id', id);
        if (additionalOptions.keyword) params.set('keyword', additionalOptions.keyword);
        return `${baseUrl}/${endpoint}?${params.toString()}`;
      };
    }

    const returnData: INodeExecutionData[] = [];
    let totalResults = 0;

    if (returnAll) {
      let currentStart = 1;
      while (true) {
        const response = await withRetry(() =>
          this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
            method: 'GET',
            url: buildUrl(currentStart),
            headers,
          }),
        );
        const results: JsonObject[] = response.results ?? [];
        totalResults += results.length;
        returnData.push({
          json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
        });
        if (results.length < pageSize) break;
        currentStart += pageSize;
      }
    } else {
      const response = await withRetry(() =>
        this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
          method: 'GET',
          url: buildUrl(defaultStartIndex),
          headers,
        }),
      );
      const results: JsonObject[] = response.results ?? [];
      totalResults += results.length;
      returnData.push({
        json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
      });
    }

    // Only persist lastRunTime for rolling window modes, not custom date
    if (pollInterval !== 'custom') {
      workflowStaticData.lastRunTime = currentRunTime;
    }

    if (totalResults === 0) return null;

    return [returnData];
  }
}
