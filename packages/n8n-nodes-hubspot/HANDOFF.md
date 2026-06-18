# HubSpot n8n Node — Handoff

## What this is

A custom n8n community node (`@profitpad-inc/n8n-nodes-hubspot`) for the HubSpot CRM API.

**Package path:** `packages/n8n-nodes-hubspot`
**Node name in n8n:** `HubSpot` (display name), `hubspotApi` (internal name)
**API docs:** https://developers.hubspot.com/docs/api-reference/latest/crm/using-object-apis

---

## Current state (working)

### Credentials — `nodes/HubSpot/HubspotApi.credentials.ts`
- Single **Access Token** field (password type) — user pastes a HubSpot Private App token
- Bearer auth injected via `IAuthenticateGeneric`:
  ```ts
  Authorization: '={{"Bearer " + $credentials.accessToken}}'
  ```
- Credential test: `GET https://api.hubapi.com/crm/v3/objects/contacts?limit=1`
- Icon: `file:app-icon.svg`

### Node — `nodes/HubSpot/HubSpotApi.node.ts`
- Base URL: `https://api.hubapi.com`
- All object paths: `/crm/v3/objects/{objectType}` where `objectType` is the HubSpot type ID
- Auth: `httpRequestWithAuthentication('hubspotApi', ...)` — credentials inject the Bearer header
- Content-Type and Accept headers set on every request via `BASE_HEADERS`

### Description — `nodes/HubSpot/descriptions/ObjectDescription.ts`
Single file covering the entire "Objects" resource. All old per-resource description files
(ContactDescription, CustomerDescription, etc.) have been deleted.

---

## Resource: Objects

One resource (`objects`) covers all HubSpot CRM object types via a single **Object Type** dropdown.
The dropdown supports expressions (no validation enforced — arbitrary values pass through).

### Object types

| Display name | API value (objectType in URL) |
|---|---|
| Calls | `0-48` |
| Communications | `0-18` |
| Companies | `0-2` |
| Contacts | `0-1` |
| Contracts | `0-721` |
| Deals | `0-3` |
| Emails | `emails` |
| Invoices | `0-53` |
| Leads | `0-136` |
| Line Items | `0-8` |
| Meetings | `0-47` |
| Orders | `0-123` |
| Payments | `0-101` |
| Products | `0-7` |
| Projects | `0-970` |
| Quotes | `0-14` |
| Tasks | `tasks` |
| Tickets | `0-5` |
| Users | `users` |

### Operations

| Operation | Method | URL |
|---|---|---|
| Get | GET | `/crm/v3/objects/{objectType}/{objectId}` |
| List | GET | `/crm/v3/objects/{objectType}` |
| Create | POST | `/crm/v3/objects/{objectType}` |
| Update | PATCH | `/crm/v3/objects/{objectType}/{objectId}` |
| Delete | DELETE | `/crm/v3/objects/{objectType}/{objectId}` |
| Search | POST | `/crm/v3/objects/{objectType}/search` |
| Batch Read | POST | `/crm/v3/objects/{objectType}/batch/read` |
| Batch Create | POST | `/crm/v3/objects/{objectType}/batch/create` |
| Batch Upsert | POST | `/crm/v3/objects/{objectType}/batch/upsert` |
| Batch Delete | POST | `/crm/v3/objects/{objectType}/batch/archive` |

All single-record operations (Get, List, Create, Update, Delete, Search) have a **Milliseconds Between Items** option in their Additional Options (default 50ms). The delay is applied between each input item — useful for rate limiting when processing many items.

#### Get
Additional options: `properties`, `propertiesWithHistory`, `associations`, `idProperty`, `archived`, `errorWhenNotFound`, `millisecondsBetweenItems`

- `idProperty` — look up by a property value (e.g. `email`) instead of the record ID
- `propertiesWithHistory` — returns property values alongside their historical values
- `errorWhenNotFound` (default `true`) — when `false`, a 404 returns `{ objectFound: false }` instead of throwing. On success, `objectFound: true` is merged into the response.
- 404 detection checks both `error.httpCode === '404'` (NodeApiError) and `error.response?.status === 404` (raw axios) for safety

#### List
- Returns the **full raw HubSpot response** as a single output item (not individual records)
- `returnAll: false` — single request, respects `limit` (1–100, default 50)
- `returnAll: true` — paginates via `paging.next.after`; each page is one output item (full raw response including `paging` block)
  - **Max Pages** field appears when Return All is on; `minValue: 1`, `numberPrecision: 0` (integer only). Value is also sanitized in code via `Math.max(1, Math.floor(...))`.
- Additional options: `properties`, `propertiesWithHistory`, `associations`, `after` cursor, `archived`, `millisecondsBetweenItems`

#### Create / Update
- Properties passed as a `fixedCollection` of `name`/`value` pairs
- Update supports `idProperty` option (same semantics as Get — match record by property value instead of ID)
- Both have `millisecondsBetweenItems` in their Additional Options

#### Delete
- Requires `objectId` (record ID or property value)
- Additional options: `idProperty`, `millisecondsBetweenItems`
- **idProperty flow**: when set, a GET is made first to resolve the property value to a real record ID, then the DELETE is issued against the real ID. Response: `{ success: true, id: "<realId>" }`
- Without `idProperty`: DELETE is issued directly against the provided `objectId`
- HubSpot DELETE returns 204 No Content

#### Search
- Accepts a JSON body following [HubSpot search syntax](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/objects/search/search-objects)
- Pre-filled with an example filter on `email`
- Supports `returnAll` (shared with List) and `maxPages` for pagination — sets `limit: 100` per page and tracks `paging.next.after`
- `searchLimit` (1–200, default 10) used when `returnAll` is false
- Additional options: `millisecondsBetweenItems`

#### Batch operations
- All accept a raw JSON body (pre-filled with a relevant example)
- No Additional Options; no inter-item delay
- Batch Delete calls `POST .../batch/archive` (HubSpot's archive endpoint)

### Helpers — `nodes/HubSpot/helpers.ts`
`buildHubSpotUrl(base, path, params)` — builds URLs with proper repeated params for arrays
(e.g. `?properties=email&properties=firstname` instead of `?properties[0]=email`)

### Trigger node — `nodes/HubSpot/HubspotApiTrigger.node.ts`
Stub only — `poll()` returns `null`. Not yet implemented.

---

## Key technical notes

- **URL pattern**: `/crm/v3/objects/{objectType}` works for both numeric IDs (`0-1`) and string names (`contacts`, `emails`, `tasks`). The named path `/crm/v3/contacts` returned 404 for this account.
- **Auth expression**: `={{"Bearer " + $credentials.accessToken}}` is the correct n8n expression syntax for `IAuthenticateGeneric`. The `{{...}}` format (without `=`) sends a literal string.
- **Array query params**: HubSpot expects repeated params (`?properties=a&properties=b`), not indexed. `buildHubSpotUrl` handles this via `URLSearchParams.append`.
- **Linter rule**: `@n8n/community-nodes/no-http-request-with-manual-auth` — always use `httpRequestWithAuthentication`, never `httpRequest` when credentials are involved.
- **NodeApiError wrapping**: `httpRequestWithAuthentication` throws `NodeApiError` (not raw axios errors). The 404 check uses `error.httpCode === '404'` (string). Re-thrown errors must be wrapped in `new NodeApiError(this.getNode(), error, { itemIndex: i })` or the linter complains.
- **noValidation on Object Type**: `typeOptions: { noValidation: true }` suppresses n8n's "value not in options" warning when expressions are used on the Object Type dropdown.

---

## What's next (suggested)

1. **Associations resource** — `/crm/v3/associations/{fromObjectType}/{toObjectType}/batch/read` (and create/delete). User mentioned this is planned as a second resource.
2. **Lists resource** — HubSpot lists API.
3. **Events resource** — HubSpot events API.
4. **Trigger node** — Implement polling on any object type filtered by `lastmodifieddate`.

---

## Dev commands

```bash
npm run build    # compile TypeScript → dist/
npm run lint     # run n8n linter (strict mode)
npm run dev      # start n8n dev server with hot reload at http://localhost:5678
```

Build output goes to `dist/nodes/Hubspot/` (lowercase s — matches `package.json` `n8n.nodes` paths).
