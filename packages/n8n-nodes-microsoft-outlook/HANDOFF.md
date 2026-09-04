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
| `nodes/MicrosoftOutlook/MicrosoftOutlook.node.ts` | The node class: description, `execute()`, and the `searchMessages()` operation logic |
| `nodes/MicrosoftOutlook/GenericFunctions.ts` | `microsoftGraphApiRequest` (single request + 429 retry), `paginatedMessagesRequest` (pagination loop), `MAILBOX_FOLDER_PATHS` |
| `nodes/MicrosoftOutlook/descriptions/MessageDescription.ts` | Message resource UI: Operation dropdown + all fields for Search Messages |
| `nodes/MicrosoftOutlook/microsoftOutlookIcon.svg` / `.dark.svg` | Node + credential icon (generic envelope, not the official Microsoft logo) |
| `credentials/MicrosoftOutlookApi.credentials.ts` | The app-only (client credentials) credential |

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
One resource for now: **Message** (`message`). One operation: **Search Messages**
(`searchMessages`). The Resource/Operation pattern is still used (per this repo's own
conventions) even with a single option each, so adding more resources/operations later
(Send Mail, Get Attachment, etc. — see "What's next") doesn't require restructuring the
UI.

### Search Messages fields

| Field | Notes |
|---|---|
| **Mailbox Address** | Required. The mailbox's email address, e.g. `user@example.com`. Goes into the URL as `/users/{mailboxAddress}/...` (URL-encoded). Named "Mailbox Address" rather than "Inbox" (the term used in the original request) specifically to avoid colliding with the **Mailbox Folder** option below — both would otherwise be called "Inbox" and be easy to confuse in the UI. |
| **Select** | `multiOptions`, blank by default. When empty, `$select` is omitted entirely from the request (Graph returns its own default property set). Options are exactly the 27 message properties the user listed. |
| **Filter** | Plain string, passed through as `$filter` verbatim when non-empty. No query builder — deliberately kept as raw OData text per the request ("for now just do a string for this"). |
| **Return All** | Boolean, off by default. |
| **Max Results** (shown when Return All is on) | Stops pagination once this many results have been collected across all pages. `0` = no explicit cap, but see the hard safety valve below. |
| **Return All Mode** (shown when Return All is on) | `allInOne` / `eachPage` / `eachResult`, same three-way convention as the HubSpot node in this repo. Default `eachResult`. |
| **Additional Options** → **Top** | `$top`, default `100`, clamped 1–1000 in the UI (Microsoft's own documented range for this endpoint). |
| **Additional Options** → **Skip** | `$skip`, default `0`; only added to the request when `> 0`. |
| **Additional Options** → **Order By** | `$orderby`, blank by default (omitted when unset). Options: `receivedDateTime`, `subject`, `importance`, each asc/desc. **Deliberately limited to these three** — confirmed against Microsoft's docs and a Microsoft Q&A answer that these are the only properties Graph actually supports in `$orderby` for the messages list endpoint; not a guess. See Sources below. |
| **Additional Options** → **Mailbox Folder** | `options` dropdown: All Mail (default) / Archive / Deleted Items / Drafts / Inbox / Junk Email / Sent Items. Not `noDataExpression`, so it can be switched to an expression to target a custom well-known folder name or a real folder ID that isn't in the preset list — this satisfies "make sure expression is there so they can do a custom one if need be" without needing a separate `resourceLocator`. |

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
- `paginatedMessagesRequest()` is the loop: when **Return All** is off, it's just one
  call. When on, it follows `@odata.nextLink` (which already carries every query
  parameter from the original request, so subsequent calls pass no `qs`), always waiting
  a **fixed 100ms** between page fetches — not user-configurable, per the request
  ("always delay 100 ms between pages"), unlike this repo's HubSpot node where the
  inter-item delay is a user-facing option.
  - Stops when there's no `@odata.nextLink`, or **Max Results** is hit, or a hardcoded
    **50,000-result safety valve** (`MAX_TOTAL_RESULTS`) is hit — mirroring the reference
    Python script's own `if len(emails_json) > 50_000: raise SystemExit()` guard against
    an unbounded loop against a huge mailbox.
- `allInOne` / `eachResult` modes flatten every page's `value` array before trimming to
  **Max Results** and building output items. `eachPage` mode returns each raw page
  response as its own item and does **not** trim an individual page's `value` array to
  the Max Results boundary — it just stops fetching further pages once the boundary is
  crossed, so the last page emitted can slightly exceed Max Results. Same trade-off
  HubSpot's `eachPage` mode makes in this repo.

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
  credential points at the same SVGs the node uses (`../nodes/MicrosoftOutlook/...`).
- **`preAuthentication` + `expirable: true`** is the load-bearing mechanism behind the
  whole credential — see the Credential section above before touching any of its fields.

---

## What's next (suggested)

Only **Message → Search Messages** exists today, deliberately ("only 1 action for now").
Natural next additions, once requested:
1. **Message → Get** (single message by ID), **Send**, **Reply**, **Move**, **Delete**.
2. **Attachments** — list/get/download/add, as their own resource.
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
- n8n's own shipped credentials (read locally from an installed `n8n-nodes-base`, not
  fetched): `Auth0ManagementApi.credentials.js` (the `preAuthentication` pattern this
  credential follows) and `MicrosoftAzureMonitorOAuth2Api.credentials.js` (confirms the
  `{{$self["tenantId"]}}`-style tenant-specific token URL pattern, for context — not
  actually used here since this credential doesn't extend `oAuth2Api`).

---

## Dev commands

```bash
npm run build    # compile TypeScript → dist/
npm run lint     # run n8n linter (strict mode)
npm run dev      # start n8n dev server with hot reload at http://localhost:5678
```

Per `AGENTS.md`, don't run the dev n8n instance to test — leave testing to the user.

Both `npm run build` and `npm run lint` are clean as of this handoff.
