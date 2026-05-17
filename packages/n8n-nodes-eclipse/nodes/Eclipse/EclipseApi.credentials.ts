import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class EclipseApi implements ICredentialType {
  name = 'eclipseApi';
  displayName = 'Eclipse API';
  icon = 'file:epicor-eclipse.svg' as const;
  documentationUrl = 'https://epicoreclipse.com';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: '',
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
  ];

  // Eclipse uses session-based auth: the node creates a session token via
  // POST /Sessions and injects it as a header. This generic authenticate
  // block satisfies n8n's auth infrastructure while the token exchange is
  // handled programmatically inside the node's execute method.
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {},
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
