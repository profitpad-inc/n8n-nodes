import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class EclipseApi implements ICredentialType {
  name = 'eclipseApi';
  displayName = 'Eclipse API';
  icon = 'file:epicor-eclipse.png' as const;
  documentationUrl = 'https://epicoreclipse.com';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://fairbank-equipment-api.epicoreclipse.com',
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
}