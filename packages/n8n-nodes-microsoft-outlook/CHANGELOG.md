# Changelog

## 0.1.0

- Initial release: Microsoft Outlook node and credential.
- Credential: **Microsoft Outlook API**, an app-only (client credentials) service key —
  Tenant ID, Client ID, Client Secret, and Scope, plus a freeform Notes field.
- Node: **Microsoft Outlook**, resource **Message**, operation **Search Messages** —
  lists/searches a mailbox's messages via Microsoft Graph, with `$select`, `$filter`,
  `$top`, `$skip`, `$orderby`, a mail folder picker, and Return All pagination
  (All Results as 1 Item / Each Page as 1 Item / Each Result as 1 Item), with
  automatic retry on HTTP 429 responses.
