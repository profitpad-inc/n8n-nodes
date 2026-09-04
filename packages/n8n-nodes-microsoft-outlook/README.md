# n8n-nodes-microsoft-outlook

This is an n8n community node. It lets you use Microsoft Outlook in your n8n workflows.

Microsoft Outlook is Microsoft's email, calendar, and contacts service, accessed here
through the Microsoft Graph API using an app-only (client credentials) service key.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

**Message**
- **Search Messages** — list/search a mailbox's messages, with `$select`, `$filter`,
  `$top`, `$skip`, `$orderby`, a mail folder picker (Inbox, Sent Items, Drafts, Archive,
  Deleted Items, Junk Email, or all mail), and Return All pagination.

## Credentials

This node authenticates as an application, not as a signed-in user, via Microsoft
Entra ID's OAuth2 client credentials ("app-only") flow. You'll need:

1. An app registration in Microsoft Entra ID (Azure AD), with a client secret generated
   for it and the Microsoft Graph application permissions your use case needs (e.g.
   `Mail.Read` or `Mail.ReadWrite`) granted with admin consent.
2. The registration's **Directory (tenant) ID**, **Application (client) ID**, and the
   **Client Secret** value.

Enter these, plus a **Scope** (defaults to `https://graph.microsoft.com/.default`, which
requests whatever application permissions are configured on the app registration), into
the **Microsoft Outlook API** credential. A **Notes** field is also available purely for
your own reference and isn't used by the node.

## Compatibility

Built and tested against the `n8n-workflow` API version declared in `package.json`
(`n8nNodesApiVersion: 1`).

## Usage

Every request targets a specific mailbox by email address (the **Mailbox Address**
field) — there's no "current user" mailbox, since the credential authenticates as an
application rather than a person.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Microsoft Graph mail API overview](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
* [Microsoft identity platform client credentials flow](https://learn.microsoft.com/en-us/graph/auth-v2-service)

## Version history

- **0.1.0** — Initial release: Microsoft Outlook API credential (app-only) and the
  Microsoft Outlook node's Message → Search Messages operation.
