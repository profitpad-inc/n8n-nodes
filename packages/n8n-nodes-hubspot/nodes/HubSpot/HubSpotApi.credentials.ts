import {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class HubspotApi implements ICredentialType {
  name = 'hubspotApi';
  displayName = 'Hubspot';
  icon = 'file:hubspot-icon.svg' as const;

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://your-instance.epicorhubspot.com',
      placeholder: 'https://your-instance.epicorhubspot.com',
      description: 'The base URL of your Hubspot API instance',
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
