# Microsoft Outlook n8n Node — Handoff

## What this is

A custom n8n community node (`n8n-nodes-microsoft-outlook`) for the Microsoft Outlook /
Microsoft Graph API, authenticating as an application (app-only / service key), not on
behalf of a signed-in user.

**Package path:** `packages/n8n-nodes-microsoft-outlook`
**Node in n8n:** `Microsoft Outlook` (internal name `microsoftOutlook`)
**API docs:** https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview

The released version in `package.json` is `0.1.0` (first real release — the scaffolded
`Example` node/credential have been deleted).

---

## File map

| File | What lives there |
|---|---|
| `nodes/MicrosoftOutlook/MicrosoftOutlook.node.ts` | The node class: description, `execute()`, and the `searchMessages()` / `getMessage()` / `sendMail()` operation logic |
| `nodes/MicrosoftOutlook/GenericFunctions.ts` | `microsoftGraphApiRequest` (single request + 429 retry, optional body for writes), `paginatedGraphRequest` (pagination loop, generic across any Graph collection endpoint), `fetchAllGraphResults` (paginate + flatten, used for attachments), `MAILBOX_FOLDER_PATHS` |
| `nodes/MicrosoftOutlook/descriptions/MessageDescription.ts` | Message resource UI: Operation dropdown + all fields for both operations |
| `nodes/MicrosoftOutlook/microsoftOutlookIcon.svg` | The node's icon |
| `credentials/MicrosoftOutlookApi.credentials.ts` | The app-only (client credentials) credential |
| `credentials/microsoftEntraIcon.png` | The credential's icon — downloaded from a URL the user gave directly (`https://adoption.microsoft.com/wp-content/uploads/2025/05/icon-microsoft-entra.png`), not the node's own icon |

---

## Credential — `MicrosoftOutlookApi.credentials.ts`

Modeled directly on the Python reference the node was built from: a Microsoft Entra ID
app registration authenticating itself (no user sign-in), via OAuth2's **client
credentials** grant against `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`.

### Fields
- **Tenant ID** (required) — needed to build the tenant-specific token URL. The user's
  spec only explicitly called out Client ID / Client Secret / Scope as "the 3 mandatory
  fields" for the auth; Tenant ID was added anyway because the token endpoint is
  tenant-specific and there's no functioning app-only flow without it. Flagged here as a
  deliberate addition beyond the literal spec, not an oversight.
- **Client ID** (required)
- **Client Secret** (required, `password: true`)
- **Scope** (required, default `https://graph.microsoft.com/.default`, user-editable)
- **Notes** (optional, multiline) — freeform text, purely for the user's own reference.
  Never read by any code path; it's not sent anywhere and not used in requests.
- **Access Token** — hidden, `typeOptions: { expirable: true, password: true }`. Not a
  form field the user sees or fills in.

### How authentication actually works
This does **not** extend n8n's built-in `oAuth2Api` credential type. That base type is
built around the "Connect my account" UI flow and doesn't have a supported way to attach
a custom `test` request when the grant type is `clientCredentials` (confirmed by
checking every OAuth2-extending credential shipped in `n8n-nodes-base`: none of them
define `test`). Since the user explicitly wants the Auth0-style test-and-verify UX
described in the reference Python script, this credential instead follows n8n's
**`preAuthentication`** pattern — the same one n8n-nodes-base's own `Auth0ManagementApi`
credential uses for its own client-credentials exchange:
- `preAuthentication()` POSTs to the tenant's token endpoint (`grant_type=client_credentials`,
  `client_id`, `client_secret`, `scope`) using `this.helpers.httpRequest` (the only HTTP
  call in this codebase that isn't `httpRequestWithAuthentication` — it can't be, since
  there's no token yet to authenticate with) and returns `{ accessToken: <token> }`.
- That return value is merged into the credential's decrypted data under the hidden,
  `expirable: true` **Access Token** field — n8n's own credential runtime (not this
  package's code) is what makes this actually work end-to-end:
  - It calls `preAuthentication` once before the very first request a node makes with
    this credential.
  - If a request comes back `401`, it calls `preAuthentication` again
    (`credentialsExpired = true`) and retries once.
  - The fetched token is cached inside the encrypted credential storage itself, so it
    survives across node executions and n8n restarts — there's no in-memory cache in
    this package to go stale or leak between credentials.
- `authenticate` is the plain generic-auth header injection:
  `Authorization: Bearer {{$credentials.accessToken}}`.
- `test` hits `GET https://graph.microsoft.com/v1.0/` — the exact request the reference
  Python script's `test_auth()` makes — and n8n runs it through the same
  `preAuthentication` → `authenticate` pipeline, so clicking "Test" in the credential UI
  exercises the real token exchange.

**Why not just use `httpRequestWithAuthentication` with a hand-rolled `authenticate`
function that fetches a token itself?** That was the first design considered, but it
would need its own in-memory token cache (module-level `Map`, invisible to n8n, lost on
every restart, and running the risk of never being refreshed correctly across concurrent
executions). `preAuthentication` + `expirable: true` is the officially supported n8n
mechanism for exactly this "exchange static credentials for a short-lived bearer token"
shape, and it's what n8n's own bundled nodes use for the same problem — so this rides on
already-tested infrastructure instead of reinventing it.

---

## Node — `MicrosoftOutlook.node.ts`

**Programmatic-style**, not declarative — chosen because a single execution of one item
can mean multiple dependent HTTP calls (pagination following `@odata.nextLink`, each one
individually retried on 429), which isn't expressible as a single declarative
`routing` block.

### Resource / Operation
One resource for now: **Message** (`message`). Three operations: **Get Message**
(`getMessage`), **Search Messages** (`searchMessages`), **Send Mail** (`sendMail`).
**Mailbox Address** is a shared field definition across all three (same `name`,
`displayOptions.show.operation` listing every value that needs it) rather than
duplicated per operation — this is the same "one field, several operations" pattern the
HubSpot node in this repo already relies on (e.g. its two `operation` dropdowns for
merge-eligible vs other object types). **Select** is shared between Get Message and
Search Messages only.

### Get Message fields

| Field | Notes |
|---|---|
| **Mailbox Address** | Shared with Search Messages, see below. |
| **Message ID** | Required. The Graph message `id` (e.g. from a prior Search Messages call) — not validated client-side beyond being a non-empty string, since Graph message IDs are opaque, non-uniform-length strings. |
| **Select** | Shared with Search Messages, see below. |
| **Include Attachments** | `options` dropdown, defaults to **Do Not Include** (`none`) — no extra request is made unless this is changed. Any other value fetches `.../messages/{id}/attachments` and **always** merges the attachment objects onto the output under an `attachments` key, regardless of mode — see the contentBytes rule below for the one difference between modes. **Include As File** (`file`) and **Include In Both** (`both`) additionally convert each file attachment into n8n binary data (see below). Pagination across attachment pages is handled internally (`fetchAllGraphResults`) but isn't user-configurable — a single message's attachment list is expected to be small, so there's no Return All / Max Results exposed for it, unlike Search Messages. |

#### The `attachments` JSON array and `contentBytes`

Every mode except **Do Not Include** puts the fetched attachments onto `message.attachments`
as-is from Graph — **except** the `contentBytes` field (the base64 file content), which is
stripped from each entry whenever a binary copy also exists (**Include As File** /
**Include In Both**). Only **Include In JSON** keeps `contentBytes` in the JSON output. The
rule, and the reasoning: once the actual bytes live in `binary`, repeating the same
(potentially large) base64 string in `json.attachments[].contentBytes` is pure duplication
with no upside — `stripContentBytes()` in `MicrosoftOutlook.node.ts` does this via a
shallow-copy-and-delete rather than a destructuring omit, to sidestep an unused-variable
lint complaint on the omitted key. Everything else about each attachment (`id`, `name`,
`contentType`, `size`, `isInline`, `@odata.type`, ...) is always present in the JSON
regardless of mode.

#### Include As File / Include In Both — binary conversion

`attachmentsToBinary()` in `MicrosoftOutlook.node.ts` walks the fetched attachment list
and, for each one whose `@odata.type` contains `fileAttachment` (case-insensitively —
Graph examples show this both with and without the OData `#` prefix, so the check
doesn't rely on an exact string match) **and** has a `contentBytes` value, decodes the
base64 into a `Buffer` and calls `this.helpers.prepareBinaryData(buffer, attachment.name,
attachment.contentType)`. Item attachments (an embedded message/event) and reference
attachments (a link, e.g. to OneDrive) have neither trait — no raw bytes to attach — so
they're silently skipped for binary output; they're still present (metadata only, per
above) in the JSON `attachments` array.

Each converted file lands under its own binary property, keyed `attachment_0`,
`attachment_1`, ... in the order Graph returned them (not by attachment name — names
aren't guaranteed unique or safe as object keys). `executionData.binary` is only set at
all when the mode is **Include As File** or **Include In Both**; a message with zero
convertible attachments in "as file" mode still returns the message JSON, just with an
empty `binary: {}`.

### Search Messages fields

| Field | Notes |
|---|---|
| **Mailbox Address** | Required. The mailbox's email address, e.g. `user@example.com`. Goes into the URL as `/users/{mailboxAddress}/...` (URL-encoded). Named "Mailbox Address" rather than "Inbox" (the term used in the original request) specifically to avoid colliding with the **Mailbox Folder** option below — both would otherwise be called "Inbox" and be easy to confuse in the UI. Shared with Get Message. |
| **Select** | `multiOptions`, blank by default. When empty, `$select` is omitted entirely from the request (Graph returns its own default property set). Options are exactly the 27 message properties the user listed. Shared with Get Message. |
| **Filter** | Plain string, passed through as `$filter` verbatim when non-empty. No query builder — deliberately kept as raw OData text per the request ("for now just do a string for this"). |
| **Return All** | Boolean, off by default. |
| **Max Results** (shown when Return All is on) | Stops pagination once this many results have been collected across all pages. `0` = no explicit cap, but see the hard safety valve below. |
| **Return All Mode** (shown when Return All is on) | `allInOne` / `eachPage` / `eachResult`, same three-way convention as the HubSpot node in this repo. Default `eachResult`. |
| **Additional Options** → **Mailbox Folder** | `options` dropdown: All Mail (default) / Archive / Deleted Items / Drafts / Inbox / Junk Email / Sent Items. Not `noDataExpression`, so it can be switched to an expression to target a custom well-known folder name or a real folder ID that isn't in the preset list — this satisfies "make sure expression is there so they can do a custom one if need be" without needing a separate `resourceLocator`. |
| **Additional Options** → **Order By** | `$orderby`, blank by default (omitted when unset). Options: `receivedDateTime`, `subject`, `importance`, each asc/desc. **Deliberately limited to these three** — confirmed against Microsoft's docs and a Microsoft Q&A answer that these are the only properties Graph actually supports in `$orderby` for the messages list endpoint; not a guess. See Sources below. |
| **Additional Options** → **Page Size** | `$top`, default `100`, clamped 1–1000 in the UI (Microsoft's own documented range for this endpoint). Internal parameter name is still `top` (and the description still talks about `$top`) — only the on-screen label was renamed to "Page Size" on request. |
| **Additional Options** → **Search** | `$search`, blank by default (omitted when unset) — added because `$filter` has no real substring/"contains" support for messages (confirmed against Microsoft's docs: `$filter` on messages only documents `eq`/`ne`/`startswith()`; a true keyword/substring match needs the separate `$search` query parameter with KQL-style `property:text` clauses, e.g. `subject:invoice`). Originally a top-level field; moved into Additional Options on request, alongside the other query-parameter fields it keeps company with (Order By, Page Size, Skip). See "The Search field" below for the auto-quoting behavior and its interaction with Order By. |
| **Additional Options** → **Skip** | `$skip`, default `0`; only added to the request when `> 0`. |

#### The Search field ($search)

Added specifically because `$filter` can't do substring matching on messages —
confirmed against Microsoft's own `$filter` reference (only `eq`/`ne`/`startswith()` are
documented there for string properties; `contains()`'s documented examples are for other
resources, not messages) and the `$search` reference (which spells out KQL-style
`property:text` clauses — `subject:`, `from:`, `body:`, `participants:`, etc. — as the
supported way to search message text).

- **Auto-quoting**: Graph requires every `$search` clause to be wrapped in double quotes
  (`$search="subject:invoice"`). Typing just `subject:invoice` in the field is enough —
  `searchMessages()` wraps it in quotes automatically. A value that **already starts with
  a quote** is passed through untouched instead, so a power user can still write a full
  multi-clause expression themselves (Graph's own `AND`/`OR` syntax needs each clause
  individually quoted, e.g. `"subject:invoice" OR "subject:receipt"` — auto-wrapping the
  whole thing would double-quote and break it).
- **Interacts with Order By**: Microsoft's docs state search results are always sorted by
  sent date/time — the Additional Options → Order By field has no effect while Search is
  set. This isn't enforced in code (the UI field stays visible and whatever value it has
  is still sent as `$orderby`); it's just documented here since it'll otherwise look like
  a bug when Order By is silently ignored.
- **Combinable with Filter**: both are just separate query parameters sent in the same
  request when both fields are non-empty — Microsoft's general `$search` docs show
  `$filter` and `$search` combined (for a different resource, groups, but the mechanism
  is the same: both params are ANDed together by Graph). Not specially wired together in
  this node's code beyond both being added to the same `qs` object.
- **No Return All caveat needed**: `$search` on messages still returns a normal paged
  response with `@odata.nextLink` (capped at 1,000 total results per Microsoft's docs),
  so it flows through the exact same `paginatedGraphRequest()` loop as a `$filter`-only
  or unfiltered search — no special-casing needed for pagination.

### Send Mail fields

| Field | Notes |
|---|---|
| **Mailbox Address** | Shared with Get Message / Search Messages — here it's the *sending* mailbox. |
| **Subject** | Plain string, optional (Graph itself doesn't require a subject). |
| **HTML Body** | Multi-line string, sent as `body: { contentType: 'HTML', content: <value> }`. Always HTML — there's no plain-text mode, since the user only asked for an HTML body. |
| **Recipients Input Mode** | `options`: **Fields** (default) or **JSON**. **One shared selector for To/CC/BCC together** — not a mode per recipient list. An earlier version had a separate mode dropdown per list (`toMode`, `ccMode`, `bccMode`); the user saw the resulting UI (three "Input Mode" dropdowns in a row) and asked for a single one instead. |
| **To** / **To (JSON)** | See "Recipient fields" below. **To** is the only recipient list where at least one entry is enforced — see below. The JSON field's `default` is a filled-in example array (`[{"name": "Jane Doe", "email": "jane@example.com"}]`), not `'[]'` — unlike CC/BCC, since an empty To is never actually valid, showing an example nudges toward the right shape rather than a value that has to be replaced outright. |
| **CC** / **CC (JSON)** | Same shape as To, optional. JSON default is `'[]'` — empty is the common, valid case here. |
| **BCC** / **BCC (JSON)** | Same shape as To, optional. JSON default is `'[]'`, same reasoning as CC. |
| **Attachments Input Mode** | `options`: **None** (default) / **Base64** / **JSON** / **N8n Files** / **URLs**. See "Attachment fields" below. |
| **Additional Options** → **Save To Sent Items** | Boolean, defaults **on** (`true`), matching Graph's own default and the request. Only sent to Graph as `saveToSentItems` at the top level of the request body (a sibling of `message`, not inside it) — that's Graph's own required shape, confirmed against Microsoft's docs. |

#### Recipient fields (To / CC / BCC)

`buildRecipientFields(prefix, label, required)` in `MessageDescription.ts` generates the
**Fields** + **JSON** pair for each of `to` / `cc` / `bcc`, since the user asked for CC
and BCC to be "same as To" — but not their own mode toggle; all three read the single
`recipientsMode` field declared once, ahead of them, in `messageFields`:
- **`<prefix>Recipients`** — a `fixedCollection` (`multipleValues: true`), shown when
  `recipientsMode === 'fields'`: each entry has **Email** (required) and **Name**
  (optional).
- **`<prefix>Json`** — a `json`-typed field, shown when `recipientsMode === 'json'`,
  default `'[]'`: an array of `{ "email": ..., "name": ... }` objects (`name` optional)
  — deliberately **not** Graph's own `{ emailAddress: { address, name } }` shape, so
  switching Recipients Input Mode doesn't require learning two different shapes for the
  same recipient.

`resolveRecipients()` in `MicrosoftOutlook.node.ts` takes the shared mode as a parameter
(read once in `sendMail()`, not re-read per recipient list) and converts whichever
source is active into Graph's `[{ emailAddress: { address, name? } }]` array, dropping
any entry with no email in both modes. **To** is the one list where the
resolved array is checked for `length === 0` after conversion and a
`NodeOperationError` is thrown if so ("At least one To recipient is required") — this is
a **runtime check, not a UI-level constraint**, because `fixedCollection` has no built-in
"minimum entries" validation in n8n, and the JSON path obviously can't be validated by
the UI either. CC/BCC skip this check entirely (an empty array there just means the
corresponding `ccRecipients`/`bccRecipients` key is omitted from the request body, not
sent as `[]`).

#### Attachment fields (Base64 / JSON / N8n Files / URLs)

`resolveAttachments()` in `MicrosoftOutlook.node.ts` reads **Attachments Input Mode**
and returns an array of Graph `fileAttachment` objects
(`{ '@odata.type': '#microsoft.graph.fileAttachment', name, contentType?, contentBytes }`)
— `buildFileAttachment()` is the one place that shape gets built, shared by all four
modes so the sourcing paths below only differ in *where the base64 comes from*:

- **Base64** — a `fixedCollection` (**Attachments (Base64)**, `attachmentsBase64`),
  each entry giving **File Name** (required), **Content Type** (optional — left out of
  the request entirely when blank, so Graph infers it), and **Content (Base64)**
  (required) directly. Like the Recipients `fixedCollection`s, its row count is fixed by
  however many rows were added in the node's own configuration — it does **not** vary
  per input item.
- **JSON** — a `json`-typed field (**Attachments (JSON)**, `attachmentsJson`), defaulting
  to a filled-in two-entry example (not `'[]'` — same reasoning as To (JSON): an example
  is more useful up front than an empty array the user has to replace outright): an array
  where **each entry needs either `contentBytes` (base64 — `name` is then required, since
  it can't be derived from raw bytes) or `url` (fetched and base64-encoded on the node's
  side — `name` falls back to the URL's own file name via `urlFileName()` when omitted,
  same as URLs mode below)**, plus an optional `contentType` either way. Added
  specifically so a **dynamic or unknown number of attachments** (computed by an upstream
  node, one array per item, mixing base64 and URL entries freely) isn't limited by a
  fixed number of UI rows the way Base64/URLs mode is — the same idea as Recipients'
  Fields/JSON split.
- **N8n Files** — a single string field, **Input Binary Fields**
  (`attachmentsBinaryProperties`, default `''`, empty). A comma-separated value attaches
  only those named binary properties on the current input item; **left empty (the
  default), every binary property already on the item is attached** — this is the other
  fix for "unknown quantity of attachments": since the number of binary properties on an
  item already varies naturally by item (e.g. after a Merge or Split Out node), the
  no-enumeration default handles that automatically instead of requiring the property
  names be known and typed in ahead of time. Each resolved name goes through
  `this.helpers.assertBinaryData(itemIndex, propertyName)` (metadata: `fileName`,
  `mimeType`) and `this.helpers.getBinaryDataBuffer(itemIndex, propertyName)` (the
  actual bytes), then is base64-encoded. An explicitly *named* property that doesn't
  exist on the item still throws (via `assertBinaryData`) rather than being silently
  skipped — only the auto-discovery path (empty field) can't fail this way, since it
  only ever enumerates properties that are already there.
- **URLs** — a `fixedCollection` (**Attachments (URLs)**, `attachmentsUrls`), each entry
  giving **URL** (required), and optional **File Name** / **Content Type** overrides.
  Same fixed-row-count caveat as Base64 mode — for a *dynamic* number of URLs, use
  **JSON** mode's `{ "url": ... }` entries instead (see above); both paths go through
  the same `fetchAttachmentFromUrl()` helper, so there's exactly one implementation of
  "fetch a URL and turn it into a fileAttachment," not two. Each URL is fetched with a
  **plain, unauthenticated** `this.helpers.httpRequest` (`encoding: 'arraybuffer'`,
  `returnFullResponse: true`) — deliberately *not* `httpRequestWithAuthentication`,
  since these are arbitrary user-supplied URLs with no relationship to the Microsoft
  Outlook credential (the same reasoning the credential's own `preAuthentication()`
  uses for its token-endpoint call
  — see the Credential section). When **File Name** is left blank, `urlFileName()`
  derives it from the URL's path (falling back to the literal string `'attachment'` for
  a malformed URL or a URL with no path segment); when **Content Type** is left blank,
  the response's own `Content-Type` header is used instead.

Only one mode is active per execution (per **Attachments Input Mode**), but a workflow
can call Send Mail multiple times with different modes across different items/executions.
There's no attachment size limit enforced by this node; Graph's own `sendMail` message
size limits apply as they would to any other client.

#### The request itself

`sendMail()` builds `{ message: { subject, body, toRecipients, ccRecipients?,
bccRecipients?, attachments? }, saveToSentItems }` and `POST`s it to
`.../users/{mailboxAddress}/sendMail` via `microsoftGraphApiRequest`, which now accepts
an optional `body` parameter (added for this operation — every earlier call was a GET
with no body). Graph's `sendMail` returns **`202 Accepted` with no response body at all**
(confirmed against Microsoft's docs) — `microsoftGraphApiRequest` normalizes any
non-object/empty response body to `{}` on a 2xx status rather than returning it as-is
(previously every call was a GET that always returned a real JSON object, so this never
came up). `sendMail()` itself ignores that empty body entirely and returns its own
`{ success: true }` as the output item.

### URL construction (`MAILBOX_FOLDER_PATHS` in `GenericFunctions.ts`)

```
all      → /users/{mailbox}/messages
inbox    → /users/{mailbox}/mailFolders/inbox/messages
sent     → /users/{mailbox}/mailFolders/sentitems/messages
junk     → /users/{mailbox}/mailFolders/junkemail/messages
drafts   → /users/{mailbox}/mailFolders/drafts/messages
archived → /users/{mailbox}/mailFolders/archive/messages
deleted  → /users/{mailbox}/mailFolders/deleteditems/messages
```

Any **Mailbox Folder** value not in this map (i.e. a hand-typed expression) is used
verbatim as the `mailFolders/{value}/messages` segment, so a custom well-known folder
name (`clutter`, `outbox`, ...) or a real folder ID both work without code changes.

### Pagination — `GenericFunctions.ts`

- `microsoftGraphApiRequest()` makes one request via `httpRequestWithAuthentication`
  with `returnFullResponse: true, ignoreHttpStatusErrors: true` so the status code can be
  inspected directly instead of only ever seeing a thrown `NodeApiError`. On `429`, it
  reads the `Retry-After` header (defaults to 5s if missing or non-numeric — matching the
  reference Python script's `int(response.headers.get('Retry-After', 5))`), sleeps, and
  retries the same request, up to 5 attempts before giving up with a `NodeApiError`.
- `paginatedGraphRequest()` is the loop: when `returnAll` is off, it's just one call.
  When on, it follows `@odata.nextLink` (which already carries every query parameter from
  the original request, so subsequent calls pass no `qs`), always waiting a **fixed
  100ms** between page fetches — not user-configurable, per the request ("always delay
  100 ms between pages"), unlike this repo's HubSpot node where the inter-item delay is a
  user-facing option. Named generically (not `paginatedMessagesRequest`, its original
  name) because Get Message → Include Attachments reuses the exact same loop against a
  different collection endpoint (`.../messages/{id}/attachments`).
  - Stops when there's no `@odata.nextLink`, or **Max Results** is hit, or a hardcoded
    **50,000-result safety valve** (`MAX_TOTAL_RESULTS`) is hit — mirroring the reference
    Python script's own `if len(emails_json) > 50_000: raise SystemExit()` guard against
    an unbounded loop against a huge mailbox.
- `fetchAllGraphResults()` wraps `paginatedGraphRequest()` with `returnAll: true,
  returnAllMode: 'allInOne'` hardcoded and flattens every page's `value` array into one —
  used by Get Message → Include Attachments, where there's no user-facing Return
  All/Max Results/Return All Mode at all, since a single message's attachment list isn't
  expected to be large enough to need them.
- `allInOne` / `eachResult` modes (Search Messages only) flatten every page's `value`
  array before trimming to **Max Results** and building output items. `eachPage` mode
  returns each raw page response as its own item and does **not** trim an individual
  page's `value` array to the Max Results boundary — it just stops fetching further pages
  once the boundary is crossed, so the last page emitted can slightly exceed Max Results.
  Same trade-off HubSpot's `eachPage` mode makes in this repo.

### Error handling
Follows this repo's programmatic-node convention (`.agents/nodes-programmatic.md`) with
one adjustment: the node's own linter (`@n8n/community-nodes/require-node-api-error`)
rejects a bare `throw error;` re-throw even when the caught value is already a
`NodeApiError`/`NodeOperationError` (confirmed by testing — an `instanceof`-guarded
re-throw still fails the rule; only wrapping in a fresh `new NodeOperationError(...)`
satisfies it). So unlike the doc's example pattern, every error that survives
`continueOnFail()` is unconditionally wrapped in `new NodeOperationError(this.getNode(),
error as Error, { itemIndex: i })` — this still preserves the original message text, it
just means a `NodeApiError` thrown deep inside `microsoftGraphApiRequest` ends up
re-wrapped one level rather than passed through untouched.

---

## Key technical notes

- **URL pattern**: `/users/{mailboxAddress}/messages` (app-only permissions, not `/me/`,
  since there's no signed-in user in the client-credentials flow).
- **Mailbox address is URL-encoded** (`encodeURIComponent`) before being inlined into the
  path, same for the resolved mail folder segment.
- **`$orderby` option list is intentionally short.** Confirmed against Microsoft's "List
  messages" docs and a Microsoft Q&A answer that only `receivedDateTime`, `subject`, and
  `importance` are supported — see Sources.
- **Linter rule** `@n8n/community-nodes/require-node-api-error` — no bare `throw error;`,
  ever, even behind an `instanceof` guard; always construct a new error object.
- **Linter rule** `@n8n/community-nodes/no-restricted-globals` — the pagination delay's
  `setTimeout` needs an inline `eslint-disable` comment (see `GenericFunctions.ts`).
- **Linter rule** `@n8n/community-nodes/icon-validation` / `cred-class-field-icon-missing`
  — credential classes need an `icon` property too, not just node classes. This
  credential's icon (`credentials/microsoftEntraIcon.png`) is intentionally different
  from the node's own icon (`nodes/MicrosoftOutlook/microsoftOutlookIcon.svg`) — the user
  gave an explicit PNG URL for the credential specifically, downloaded straight into
  `credentials/`.
- **`preAuthentication` + `expirable: true`** is the load-bearing mechanism behind the
  whole credential — see the Credential section above before touching any of its fields.

---

## What's next (suggested)

**Message → Search Messages**, **Message → Get Message** (with an Include Attachments
dropdown — JSON / binary file / both, or off), and **Message → Send Mail** (with a
Base64 / N8n Files / URLs attachments input mode) exist today. Natural next additions,
once requested:
1. **Message → Reply**, **Reply All**, **Forward**, **Move**, **Delete**.
2. **Send Mail → plain-text body option** — currently always HTML, per the request.
3. **Calendar / Events** — a second top-level resource, same app-only credential.
4. A **Search Filter** UI (Fields / Custom JSON) instead of the current raw `$filter`
   string, if this node grows the way the HubSpot node in this repo did.

---

## Sources consulted while building this

- [List messages — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0)
  — URL patterns, `$top` range (1–1000), `$filter`/`$orderby` combination rules.
- [Graph API to filter results on 'from' and 'subject' and order by results in DESCENDING 'receivedDateTime' — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/658420)
  — confirms `subject`, `importance`, and `receivedDateTime` as the supported `$orderby`
  properties for this endpoint.
- [Microsoft identity platform and OAuth 2.0 client credentials flow](https://learn.microsoft.com/en-us/graph/auth-v2-service)
  — the app-only token flow the credential implements.
- [Get message — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0)
  — confirms the `/users/{id}/messages/{id}` URL pattern and `$select` support for Get
  Message.
- [List attachments — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/message-list-attachments?view=graph-rest-1.0)
  — confirms the `/users/{id}/messages/{id}/attachments` URL pattern and the attachment
  object shape (`contentBytes` etc.) for Include Attachments.
- [user: sendMail — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
  — confirms the `/users/{id}/sendMail` URL, the `{ message, saveToSentItems }` request
  body shape (`saveToSentItems` as a sibling of `message`, not nested inside it), and
  that a successful call returns `202 Accepted` with no response body.
- n8n's own shipped credentials (read locally from an installed `n8n-nodes-base`, not
  fetched): `Auth0ManagementApi.credentials.js` (the `preAuthentication` pattern this
  credential follows) and `MicrosoftAzureMonitorOAuth2Api.credentials.js` (confirms the
  `{{$self["tenantId"]}}`-style tenant-specific token URL pattern, for context — not
  actually used here since this credential doesn't extend `oAuth2Api`).
- [Use the $filter query parameter — Microsoft Graph](https://learn.microsoft.com/en-us/graph/filter-query-parameter)
  — the full list of operators/functions Graph supports anywhere, and the note that
  support varies per resource; used to confirm `contains()` isn't documented for
  messages, only `eq`/`ne`/`startswith()`.
- [Use $search Query Parameter in Microsoft Graph APIs](https://learn.microsoft.com/en-us/graph/search-query-parameter)
  — the source for the **Search** field: the `property:text` KQL clause syntax, the
  required double-quoting, the "results sorted by sent date/time" behavior, the
  1,000-result cap, and that `$filter` + `$search` can be combined in one request.

---

## Dev commands

```bash
npm run build    # compile TypeScript → dist/
npm run lint     # run n8n linter (strict mode)
npm run dev      # start n8n dev server with hot reload at http://localhost:5678
```

Per `AGENTS.md`, don't run the dev n8n instance to test — leave testing to the user.

Both `npm run build` and `npm run lint` are clean as of this handoff.
