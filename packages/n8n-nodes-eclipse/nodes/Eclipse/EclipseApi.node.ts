import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
} from 'n8n-workflow';

import { contactDescription } from './descriptions/ContactDescription';
import { customerDescription } from './descriptions/CustomerDescription';
import { productDescription } from './descriptions/ProductDescription';
import { salesOrderDescription, salesOrderUpdateStatuses } from './descriptions/SalesOrderDescription';
import { applyFieldFilter, createSession, normalizeEnumValue, parseCommaSeparatedList, parseJsonParameter, toTrimmedString } from './helpers';

export class EclipseApi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Epicor Eclipse',
    name: 'eclipseApi',
    icon: 'file:app-icon.svg',
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
      ...contactDescription,
      ...customerDescription,
      ...productDescription,
      ...salesOrderDescription,
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
            const fieldsToInclude = fieldsFilterMode === 'selected' ? (this.getNodeParameter('fieldsToInclude', i) as string) : '';
            const fieldsToExclude = fieldsFilterMode === 'except' ? (this.getNodeParameter('fieldsToExclude', i) as string) : '';

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
                  json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
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
                json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
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

          // ── CREATE ──────────────────────────────────────────────────────
          if (operation === 'create') {
            const inputMode = (this.getNodeParameter('inputMode', i) as string).trim();
            let body: JsonObject;

            if (inputMode === 'json') {
              const rawJson = (this.getNodeParameter('customJson', i) as string).trim();
              body = JSON.parse(rawJson) as JsonObject;
            } else {
              const firstName = (this.getNodeParameter('firstName', i) as string).trim();
              const lastName = (this.getNodeParameter('lastName', i) as string).trim();
              const useEntityAddress = this.getNodeParameter('useEntityAddress', i) as boolean;
              const entities = this.getNodeParameter('entities', i) as string;
              const additionalFields = this.getNodeParameter('additionalFields', i) as {
                middleName?: string;
                salutation?: string;
                sortBy?: string;
                title?: string;
                website?: string;
                inactive?: boolean;
                webEnabled?: boolean;
                keywords?: string;
                classifications?: string;
                emails?: string;
                phones?: string;
              };

              body = { firstName, lastName, useEntityAddress };

              if (!useEntityAddress) {
                const addressLine1 = (this.getNodeParameter('addressLine1', i) as string).trim();
                const addressLine2 = (this.getNodeParameter('addressLine2', i) as string).trim();
                const city = (this.getNodeParameter('city', i) as string).trim();
                const state = (this.getNodeParameter('state', i) as string).trim();
                const postalCode = (this.getNodeParameter('postalCode', i) as string).trim();

                if (!state) {
                  throw new NodeOperationError(this.getNode(), 'State is required when "Use Entity Address" is false', { itemIndex: i });
                }

                body.state = state;
                if (addressLine1) body.addressLine1 = addressLine1;
                if (addressLine2) body.addressLine2 = addressLine2;
                if (city) body.city = city;
                if (postalCode) body.postalCode = postalCode;
              }

              if (additionalFields.middleName) body.middleName = additionalFields.middleName;
              if (additionalFields.salutation) body.salutation = additionalFields.salutation;
              if (additionalFields.sortBy) body.sortBy = additionalFields.sortBy;
              if (additionalFields.title) body.title = additionalFields.title;
              if (additionalFields.website) body.website = additionalFields.website;
              if (additionalFields.inactive !== undefined) body.inactive = additionalFields.inactive;
              if (additionalFields.webEnabled !== undefined) body.webEnabled = additionalFields.webEnabled;
              if (additionalFields.keywords) body.keywords = additionalFields.keywords;
              if (additionalFields.classifications) body.classifications = additionalFields.classifications;

              const entityIds = parseCommaSeparatedList(entities);
              if (entityIds.length > 0) body.entities = entityIds.map((entityId) => ({ entityId: Number(entityId) }));

              const emailAddresses = parseCommaSeparatedList(additionalFields.emails ?? '');
              if (emailAddresses.length > 0) body.emails = emailAddresses.map((address) => ({ address }));

              const phoneNumbers = parseCommaSeparatedList(additionalFields.phones ?? '');
              if (phoneNumbers.length > 0) body.phones = phoneNumbers.map((number) => ({ number }));
            }

            const createResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'POST',
              url: `${baseUrl}/Contacts`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (createResponse.statusCode < 200 || createResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Create contact failed with status ${createResponse.statusCode}`,
                description: typeof createResponse.body === 'object'
                  ? JSON.stringify(createResponse.body)
                  : String(createResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: createResponse.body as JsonObject, pairedItem: { item: i } });
          }

          // ── UPDATE ──────────────────────────────────────────────────────
          if (operation === 'update') {
            const contactId = (this.getNodeParameter('contactId', i) as string).trim();
            const inputMode = (this.getNodeParameter('inputMode', i) as string).trim();

            const existing = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/Contacts/${contactId}`,
              headers,
            });

            let body: JsonObject = { ...(existing as JsonObject) };

            if (inputMode === 'json') {
              const rawJson = (this.getNodeParameter('updateCustomJson', i) as string).trim();
              body = { ...body, ...(JSON.parse(rawJson) as JsonObject) };
            } else {
              const updateFields = this.getNodeParameter('updateFields', i) as {
                firstName?: string;
                middleName?: string;
                lastName?: string;
                salutation?: string;
                sortBy?: string;
                useEntityAddress?: boolean;
                addressLine1?: string;
                addressLine2?: string;
                city?: string;
                state?: string;
                postalCode?: string;
                title?: string;
                website?: string;
                inactive?: boolean;
                webEnabled?: boolean;
                keywords?: string;
                classifications?: string;
                entities?: string;
                emails?: string;
                phones?: string;
              };

              if (updateFields.firstName !== undefined && updateFields.firstName !== '') body.firstName = updateFields.firstName;
              if (updateFields.middleName !== undefined && updateFields.middleName !== '') body.middleName = updateFields.middleName;
              if (updateFields.lastName !== undefined && updateFields.lastName !== '') body.lastName = updateFields.lastName;
              if (updateFields.salutation !== undefined && updateFields.salutation !== '') body.salutation = updateFields.salutation;
              if (updateFields.sortBy !== undefined && updateFields.sortBy !== '') body.sortBy = updateFields.sortBy;
              if (updateFields.useEntityAddress !== undefined) body.useEntityAddress = updateFields.useEntityAddress;
              if (updateFields.addressLine1 !== undefined && updateFields.addressLine1 !== '') body.addressLine1 = updateFields.addressLine1;
              if (updateFields.addressLine2 !== undefined && updateFields.addressLine2 !== '') body.addressLine2 = updateFields.addressLine2;
              if (updateFields.city !== undefined && updateFields.city !== '') body.city = updateFields.city;
              if (updateFields.state !== undefined && updateFields.state !== '') body.state = updateFields.state;
              if (updateFields.postalCode !== undefined && updateFields.postalCode !== '') body.postalCode = updateFields.postalCode;
              if (updateFields.title !== undefined && updateFields.title !== '') body.title = updateFields.title;
              if (updateFields.website !== undefined && updateFields.website !== '') body.website = updateFields.website;
              if (updateFields.inactive !== undefined) body.inactive = updateFields.inactive;
              if (updateFields.webEnabled !== undefined) body.webEnabled = updateFields.webEnabled;
              if (updateFields.keywords !== undefined && updateFields.keywords !== '') body.keywords = updateFields.keywords;
              if (updateFields.classifications !== undefined && updateFields.classifications !== '') body.classifications = updateFields.classifications;

              const entityIds = parseCommaSeparatedList(updateFields.entities ?? '');
              if (entityIds.length > 0) body.entities = entityIds.map((entityId) => ({ entityId: Number(entityId) }));

              const emailAddresses = parseCommaSeparatedList(updateFields.emails ?? '');
              if (emailAddresses.length > 0) body.emails = emailAddresses.map((address) => ({ address }));

              const phoneNumbers = parseCommaSeparatedList(updateFields.phones ?? '');
              if (phoneNumbers.length > 0) body.phones = phoneNumbers.map((number) => ({ number }));

              const arrayFields = new Set(['entities', 'emails', 'phones']);
              const clearFields = this.getNodeParameter('clearFields', i) as string[];
              for (const field of clearFields) {
                body[field] = arrayFields.has(field) ? [] : '';
              }
            }

            const updateResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/Contacts/${contactId}`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (updateResponse.statusCode < 200 || updateResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update contact failed with status ${updateResponse.statusCode}`,
                description: typeof updateResponse.body === 'object'
                  ? JSON.stringify(updateResponse.body)
                  : String(updateResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: updateResponse.body as JsonObject, pairedItem: { item: i } });
          }

          // ── DELETE ──────────────────────────────────────────────────────
          if (operation === 'delete') {
            const contactId = (this.getNodeParameter('contactId', i) as string).trim();

            const deleteResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'DELETE',
              url: `${baseUrl}/Contacts/${contactId}`,
              headers,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (deleteResponse.statusCode < 200 || deleteResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Delete contact failed with status ${deleteResponse.statusCode}`,
                description: typeof deleteResponse.body === 'object'
                  ? JSON.stringify(deleteResponse.body)
                  : String(deleteResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: { success: true, id: contactId }, pairedItem: { item: i } });
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
            const fieldsToInclude = fieldsFilterMode === 'selected' ? (this.getNodeParameter('fieldsToInclude', i) as string) : '';
            const fieldsToExclude = fieldsFilterMode === 'except' ? (this.getNodeParameter('fieldsToExclude', i) as string) : '';

            const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
              updatedAfter?: string;
              keyword?: string;
              startIndex?: number;
              id?: string;
            };

            const ids = additionalOptions.id
              ? additionalOptions.id.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            const buildUrl = (startIndex: number, idSubset: string[] = ids): string => {
              const params = new URLSearchParams();
              params.set('pageSize', String(pageSize));
              params.set('startIndex', String(startIndex));
              params.set('includeTotalItems', 'true');
              for (const id of idSubset) params.append('id', id);
              if (additionalOptions.updatedAfter) params.set('updatedAfter', additionalOptions.updatedAfter);
              if (additionalOptions.keyword) params.set('keyword', additionalOptions.keyword);
              return `${baseUrl}/${endpoint}?${params.toString()}`;
            };

            const BATCH_SIZE = 200;
            // When fetching products by ID and the list exceeds 250, split into batches
            // and return one output item per batch regardless of the Return All setting.
            if (resource === 'product' && ids.length > BATCH_SIZE) {
              for (let b = 0; b < ids.length; b += BATCH_SIZE) {
                const chunk = ids.slice(b, b + BATCH_SIZE);
                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                  method: 'GET',
                  url: buildUrl(1, chunk),
                  headers,
                });
                const results: JsonObject[] = response.results ?? [];
                returnData.push({
                  json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
                  pairedItem: { item: i },
                });
              }
            } else if (returnAll) {
              let currentStart = 1;

              while (true) {
                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                  method: 'GET',
                  url: buildUrl(currentStart),
                  headers,
                });

                const results: JsonObject[] = response.results ?? [];
                returnData.push({
                  json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
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
                json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
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
              types?: string;
              shipToLists?: string;
              contacts?: string;
            };

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

            const typeValues = parseCommaSeparatedList(additionalFields.types ?? '');
            if (typeValues.length > 0) body.types = typeValues.map((type) => ({ type }));

            const shipToListValues = parseCommaSeparatedList(additionalFields.shipToLists ?? '');
            if (shipToListValues.length > 0) body.shipToLists = shipToListValues.map((shipToId) => ({ shipToId: Number(shipToId) }));

            const contactValues = parseCommaSeparatedList(additionalFields.contacts ?? '');
            if (contactValues.length > 0) body.contacts = contactValues.map((id) => ({ id: Number(id) }));
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
              types?: string;
              shipToLists?: string;
              contacts?: string;
            };

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

            const typeValues = parseCommaSeparatedList(updateFields.types ?? '');
            if (typeValues.length > 0) body.types = typeValues.map((type) => ({ type }));

            const shipToListValues = parseCommaSeparatedList(updateFields.shipToLists ?? '');
            if (shipToListValues.length > 0) body.shipToLists = shipToListValues.map((shipToId) => ({ shipToId: Number(shipToId) }));

            const contactValues = parseCommaSeparatedList(updateFields.contacts ?? '');
            if (contactValues.length > 0) body.contacts = contactValues.map((id) => ({ id: Number(id) }));

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

        // ── DELETE CUSTOMER ───────────────────────────────────────────────
        if (resource === 'customer' && operation === 'delete') {
          const customerId = (this.getNodeParameter('customerId', i) as string).trim();

          const deleteResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
            method: 'DELETE',
            url: `${baseUrl}/Customers/${customerId}`,
            headers,
            returnFullResponse: true,
            ignoreHttpStatusErrors: true,
          });

          if (deleteResponse.statusCode < 200 || deleteResponse.statusCode >= 300) {
            throw new NodeApiError(this.getNode(), {
              message: `Delete customer failed with status ${deleteResponse.statusCode}`,
              description: typeof deleteResponse.body === 'object'
                ? JSON.stringify(deleteResponse.body)
                : String(deleteResponse.body),
            } as JsonObject, { itemIndex: i });
          }

          returnData.push({ json: { success: true, id: customerId }, pairedItem: { item: i } });
        }

        if (resource === 'salesOrder') {

          // ── GET MANY ────────────────────────────────────────────────────
          if (operation === 'getMany') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const pageSize = this.getNodeParameter('pageSize', i) as number;
            const fieldsFilterMode = (this.getNodeParameter('fieldsFilterMode', i) as string).trim();
            const fieldsToInclude = fieldsFilterMode === 'selected' ? (this.getNodeParameter('fieldsToInclude', i) as string) : '';
            const fieldsToExclude = fieldsFilterMode === 'except' ? (this.getNodeParameter('fieldsToExclude', i) as string) : '';

            const dateFilterOptions = this.getNodeParameter('dateFilterOptions', i) as {
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
                  json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
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
                json: { ...response, results: applyFieldFilter(results, fieldsFilterMode, fieldsToInclude, fieldsToExclude) },
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
              const billToCustomerId = toTrimmedString(this.getNodeParameter('billToCustomerId', i));
              const shipToCustomerId = toTrimmedString(this.getNodeParameter('shipToCustomerId', i));
              const priceBranch = toTrimmedString(this.getNodeParameter('salesOrderPriceBranch', i));
              const shipBranch = toTrimmedString(this.getNodeParameter('salesOrderShipBranch', i));
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
              const lines = parseJsonParameter<JsonObject[]>(this.getNodeParameter('salesOrderLines', i));

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
                postalCode = toTrimmedString(this.getNodeParameter('salesOrderPostalCode', i));
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

              if (lines) body.lines = lines;
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
            const orderStatus = normalizeEnumValue(
              (this.getNodeParameter('statusOrderStatus', i) as string).trim(),
              salesOrderUpdateStatuses,
            );
            const shipDate = orderStatus === 'ShipWhenSpecified'
              ? (this.getNodeParameter('statusShipDate', i) as string).trim()
              : undefined;

            if (orderStatus === 'ShipWhenSpecified' && !shipDate) {
              throw new NodeOperationError(
                this.getNode(),
                'Ship Date is required when Order Status is "Ship When Specified"',
                { itemIndex: i },
              );
            }

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

          // ── CREATE LINE ITEMS ────────────────────────────────────────────
          if (operation === 'createLineItem') {
            const salesOrderId = (this.getNodeParameter('createLineItemSalesOrderId', i) as string).trim();
            const body = parseJsonParameter<JsonObject[]>(this.getNodeParameter('createLineItemLines', i));

            const clResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'POST',
              url: `${baseUrl}/SalesOrders/${salesOrderId}/LineItems`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (clResponse.statusCode < 200 || clResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Create line items failed with status ${clResponse.statusCode}`,
                description: typeof clResponse.body === 'object'
                  ? JSON.stringify(clResponse.body)
                  : String(clResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: clResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE LINE ITEMS PRICE ──────────────────────────────────────
          if (operation === 'updateLineItemPrice') {
            const orderId = (this.getNodeParameter('updatePriceOrderId', i) as string).trim();
            const inputMode = (this.getNodeParameter('updatePriceInputMode', i) as string).trim();

            let body: JsonObject[];
            if (inputMode === 'json') {
              body = parseJsonParameter<JsonObject[]>(this.getNodeParameter('updatePriceCustomJson', i)) ?? [];
            } else {
              const pricesParam = this.getNodeParameter('updatePriceLines', i) as {
                lineValues?: Array<{ lineId: string; value: number }>;
              };
              body = (pricesParam.lineValues ?? []).map(({ lineId, value }) => ({ lineId: toTrimmedString(lineId), value }));
            }

            const upResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/LineItems/Price`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (upResponse.statusCode < 200 || upResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update line items price failed with status ${upResponse.statusCode}`,
                description: typeof upResponse.body === 'object'
                  ? JSON.stringify(upResponse.body)
                  : String(upResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: upResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── UPDATE LINE ITEMS QUANTITY ───────────────────────────────────
          if (operation === 'updateLineItemQuantity') {
            const orderId = (this.getNodeParameter('updateQtyOrderId', i) as string).trim();
            const inputMode = (this.getNodeParameter('updateQtyInputMode', i) as string).trim();

            let body: JsonObject[];
            if (inputMode === 'json') {
              body = parseJsonParameter<JsonObject[]>(this.getNodeParameter('updateQtyCustomJson', i)) ?? [];
            } else {
              const qtyParam = this.getNodeParameter('updateQtyLines', i) as {
                lineValues?: Array<{ lineId: string; qty: number; um: string }>;
              };
              body = (qtyParam.lineValues ?? []).map(({ lineId, qty, um }) => ({
                lineId: toTrimmedString(lineId),
                qty,
                um: toTrimmedString(um),
              }));
            }

            const uqResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'PUT',
              url: `${baseUrl}/SalesOrders/${orderId}/QtyLineItems`,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body,
              json: true,
              returnFullResponse: true,
              ignoreHttpStatusErrors: true,
            });

            if (uqResponse.statusCode < 200 || uqResponse.statusCode >= 300) {
              throw new NodeApiError(this.getNode(), {
                message: `Update line items quantity failed with status ${uqResponse.statusCode}`,
                description: typeof uqResponse.body === 'object'
                  ? JSON.stringify(uqResponse.body)
                  : String(uqResponse.body),
              } as JsonObject, { itemIndex: i });
            }

            returnData.push({ json: uqResponse.body as JsonObject ?? {}, pairedItem: { item: i } });
          }

          // ── DELETE LINE ITEMS ─────────────────────────────────────────────
          if (operation === 'deleteLineItem') {
            const orderId = (this.getNodeParameter('deleteLineItemOrderId', i) as string).trim();
            const rawLineItemIds = toTrimmedString(this.getNodeParameter('deleteLineItemLineItemId', i));
            const lineItemIds = rawLineItemIds.split(',').map((id) => id.trim()).filter(Boolean);

            // The API only accepts one lineItemId per request, so multiple
            // comma-separated IDs are sent as separate sequential requests.
            // Only the last response is returned to the workflow.
            let dlResponse: { statusCode: number; body: unknown } | undefined;
            for (const lineItemId of lineItemIds) {
              dlResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
                method: 'DELETE',
                url: `${baseUrl}/SalesOrders/${orderId}/LineItems`,
                headers: { ...headers, 'Content-Type': 'application/json' },
                qs: { lineItemId },
                body: {},
                json: true,
                returnFullResponse: true,
                ignoreHttpStatusErrors: true,
              });

              if (dlResponse!.statusCode < 200 || dlResponse!.statusCode >= 300) {
                throw new NodeApiError(this.getNode(), {
                  message: `Delete line items failed with status ${dlResponse!.statusCode} (lineItemId ${lineItemId})`,
                  description: typeof dlResponse!.body === 'object'
                    ? JSON.stringify(dlResponse!.body)
                    : String(dlResponse!.body),
                } as JsonObject, { itemIndex: i });
              }
            }

            returnData.push({ json: dlResponse?.body as JsonObject ?? {}, pairedItem: { item: i } });
          }
        }

        if (resource === 'product' && operation === 'getProductInventoryPricingInquiry') {
          const customerId = (this.getNodeParameter('pricingCustomerId', i) as string).trim();
          const productId = (this.getNodeParameter('pricingProductId', i) as string).trim();
          const considerUserAuthBranch = this.getNodeParameter('considerUserAuthBranch', i) as boolean;
          const userId = considerUserAuthBranch ? (this.getNodeParameter('pricingUserId', i) as string).trim() : undefined;

          const sharedQs: Record<string, string> = { CustomerId: customerId, ProductId: productId };
          if (considerUserAuthBranch && userId) sharedQs.UserId = userId;

          const [inventoryResponse, singlePricingResponse, maxPricingResponse] = await Promise.all([
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
              qs: { ...sharedQs, ShowCost: 'true', ConsiderUserAuthBranch: String(considerUserAuthBranch), Quantity: 1 },
            }),
            this.helpers.httpRequestWithAuthentication.call(this, 'eclipseApi', {
              method: 'GET',
              url: `${baseUrl}/ProductPricingInquiry`,
              headers,
              qs: { ...sharedQs, ShowCost: 'true', ConsiderUserAuthBranch: String(considerUserAuthBranch), Quantity: 1000000 },
            }),
          ]);

          // the single pricing resposne doesn't return quantityBreaks
          // and the maxPricing response has the wrong value for the first quantity break
          if (maxPricingResponse.quantityBreaks.length > 0) {
            singlePricingResponse.quantityBreaks = maxPricingResponse.quantityBreaks
            singlePricingResponse.quantityBreaks[0].unitPrice.value = singlePricingResponse.productUnitPrice.value
          }

          returnData.push({ json: { ...singlePricingResponse, ...inventoryResponse }, pairedItem: { item: i } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          const nodeError = error instanceof NodeApiError || error instanceof NodeOperationError
            ? error
            : new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
          const description = nodeError.description;
          let details: unknown = description ?? undefined;
          if (typeof description === 'string') {
            try {
              details = JSON.parse(description);
            } catch {
              details = description;
            }
          }
          returnData.push({
            json: {
              error: nodeError.message,
              message: details ?? nodeError.message,
            },
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
