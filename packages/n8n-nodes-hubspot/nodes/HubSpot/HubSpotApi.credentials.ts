import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HubspotApi implements ICredentialType {
	name = 'hubspotApi';
	displayName = 'HubSpot API';
	documentationUrl = 'https://developers.hubspot.com/docs/api/overview';
	icon = 'file:app-icon.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Private App access token from HubSpot',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.hubapi.com',
			url: '/crm/v3/objects/contacts',
			method: 'GET',
			qs: {
				limit: 1,
			},
		},
	};
}
