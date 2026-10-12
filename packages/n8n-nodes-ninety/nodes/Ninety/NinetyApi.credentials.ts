import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NinetyApi implements ICredentialType {
	name = 'ninetyApi';
	displayName = 'Ninety API';
	documentationUrl = 'https://api.public.ninety.io/v1/swagger';
	icon = 'file:ninety.svg' as const;

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
			displayName: 'Personal Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description:
				'Personal Access Token from Ninety. Generate one at https://app.ninety.io/settings/user/developer-settings.',
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
			baseURL: 'https://api.public.ninety.io',
			url: '/v1/teams',
			method: 'GET',
		},
	};
}
