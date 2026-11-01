import {
  IAuthenticate,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IDataObject,
  IHttpRequestHelper,
  IHttpRequestOptions,
  INodeProperties,
} from 'n8n-workflow';
import { withRetry } from './helpers';

export class EclipseApi implements ICredentialType {
  name = 'eclipseApi';
  displayName = 'Epicor Eclipse';
  icon = 'file:app-icon.svg' as const;

  properties: INodeProperties[] = [
    {
      displayName: 'Credential Notes',
      name: 'notes',
      type: 'string',
      typeOptions: {
        rows: 3,
      },
      default: '',
      description: 'Optional notes about this credential (not used in requests)',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://your-instance.epicoreclipse.com',
      placeholder: 'https://your-instance.epicoreclipse.com',
      description: 'The base URL of your Eclipse API instance',
      required: true,
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
    },
    // Filled in by preAuthentication below, so the credential works in the
    // HTTP Request node ("Predefined Credential Type"). `expirable` tells n8n
    // to call preAuthentication again when it's empty or when a request
    // using it gets a 401, which is what Eclipse returns for an invalid or
    // expired token ("Invalid session token.").
    {
      displayName: 'Session Token',
      name: 'sessionToken',
      type: 'hidden',
      typeOptions: {
        expirable: true,
        password: true,
      },
      default: '',
    },
  ];

  async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject): Promise<IDataObject> {
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    try {
      const response = await withRetry(() =>
        this.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/Sessions`,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: { username: credentials.username, password: credentials.password },
          json: true,
        }),
      );
      return { sessionToken: response.sessionToken as string };
    } catch (error) {
      // The raw error carries the request body (username and password), so
      // rethrow only the status. No node is available here for a NodeApiError.
      const status = (error as { response?: { status?: number } })?.response?.status;
      throw new Error(`Eclipse login (POST /Sessions) failed${status ? ` with status code ${status}` : ''}`);
    }
  }

  // Adds the stored session token as the `sessionToken` header. The Eclipse
  // nodes manage their own token and already set that header, so an existing
  // one is left alone.
  authenticate: IAuthenticate = async (credentials, requestOptions): Promise<IHttpRequestOptions> => {
    const headers = (requestOptions.headers ?? {}) as IDataObject;
    if (Object.keys(headers).some((name) => name.toLowerCase() === 'sessiontoken')) {
      return requestOptions;
    }
    return {
      ...requestOptions,
      headers: { ...headers, sessionToken: credentials.sessionToken as string },
    };
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/Sessions',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: {
        username: '={{$credentials.username}}',
        password: '={{$credentials.password}}',
      },
      json: true,
    },
  };
}
