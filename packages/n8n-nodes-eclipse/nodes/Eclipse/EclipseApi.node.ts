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
    displayName: 'Epicor Eclipses',
    name: 'eclipseApi',
    icon: 'file:eclipse-icon.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with the Epicor Eclipse API',
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
            description: 'Return only the specified fields from each result',
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
                return results.map((r) => {
                  const out: JsonObject = {};
                  for (const f of fields) if (f in r) out[f] = r[f];
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
