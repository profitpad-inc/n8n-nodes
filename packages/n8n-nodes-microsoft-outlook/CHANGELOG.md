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
- Node: **Microsoft Outlook**, resource **Message**, operation **Get Message** —
  retrieves a single message by ID, with `$select` and an **Include Attachments**
  dropdown (Do Not Include / Include In JSON / Include As File / Include In Both) that
  fetches the message's attachments and merges their metadata into the JSON output,
  converts file attachments to n8n binary data, or both — `contentBytes` is only kept
  in the JSON when there's no binary copy already carrying it.
- Node: **Microsoft Outlook**, resource **Message**, operation **Send Mail** — sends an
  HTML email from a mailbox, with To/CC/BCC recipient lists (a single Fields/JSON mode
  shared across all three; To requires at least one recipient), attachments (pasted
  Base64, a dynamic JSON array accepting a mix of base64 or URL entries, n8n binary data
  on the input item — auto-attaching every binary property when left unspecified — or a
  fixed list of URLs), and a Save To Sent Items option (default on).
