import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

export class MicrosoftOutlookApi implements ICredentialType {
	name = 'microsoftOutlookApi';
	displayName = 'Microsoft Outlook API';
	icon = { light: 'file:../nodes/MicrosoftOutlook/microsoftOutlookIcon.svg', dark: 'file:../nodes/MicrosoftOutlook/microsoftOutlook.dark.svg' } as const;
	documentationUrl = 'https://learn.microsoft.com/en-us/graph/auth-v2-service';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Tenant ID',
			name: 'tenantId',
			type: 'string',
			default: '',
			required: true,
			description:
				'The directory (tenant) ID of the Microsoft Entra ID app registration used to sign in as the application',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'The application (client) ID of the Microsoft Entra ID app registration',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'A client secret generated for the app registration',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default: 'https://graph.microsoft.com/.default',
			required: true,
			description: 'Space-separated list of scopes to request for the app-only access token',
		},
		{
			displayName: 'Notes',
			name: 'notes',
			type: 'string',
			typeOptions: {
				rows: 4,
			},
			default: '',
			description: 'Freeform notes for your own reference. Not sent to Microsoft and not used by the node.',
		},
	];

	async preAuthentication(
		this: IHttpRequestHelper,
		credentials: ICredentialDataDecryptedObject,
	) {
		const tenantId = credentials.tenantId as string;

		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				grant_type: 'client_credentials',
				client_id: credentials.clientId as string,
				client_secret: credentials.clientSecret as string,
				scope: credentials.scope as string,
			}).toString(),
			json: true,
		})) as { access_token: string };

		return { accessToken: response.access_token };
	}

	authenticate = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	} as const;

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://graph.microsoft.com/v1.0',
			url: '/',
			method: 'GET',
		},
	};
}
