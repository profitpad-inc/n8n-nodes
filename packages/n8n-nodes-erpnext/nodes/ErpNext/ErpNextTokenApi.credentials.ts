import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

// Named erpNextTokenApi (not erpNextApi) so it can never collide with the
// credential type of n8n's built-in ERPNext node on the same instance.
export class ErpNextTokenApi implements ICredentialType {
	name = 'erpNextTokenApi';
	displayName = 'ERPNext Token API';
	documentationUrl = 'https://docs.frappe.io/framework/user/en/api/rest';
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
			default: '',
			required: true,
			placeholder: 'https://erp.example.com',
			description: 'The URL of the ERPNext site, without a trailing slash',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'API key of the ERPNext user the integration acts as',
		},
		{
			displayName: 'API Secret',
			name: 'apiSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'API secret of the ERPNext user the integration acts as',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"token " + $credentials.apiKey + ":" + $credentials.apiSecret}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/method/frappe.auth.get_logged_user',
			method: 'GET',
		},
	};
}
