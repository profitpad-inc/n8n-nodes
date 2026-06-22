import {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

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
