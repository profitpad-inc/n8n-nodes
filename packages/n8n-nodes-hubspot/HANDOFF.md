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

### Node — `nodes/HubSpot/HubspotApi.node.ts`
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
- Uses the shared **Search Filter Mode** UX (see `searchFilter.ts` below): a Fields / Custom JSON
  toggle, a guided AND/OR **Filter Groups** builder with type-aware operator dropdown, a
  **Properties** multi-select, and **Sorts** / **Sorts (JSON)** under Additional Options
- Additional options: a **Query** free-text field, `millisecondsBetweenItems`
- Supports `returnAll` (shared with List) and `maxPages` for pagination — sets `limit: 100` per page and tracks `paging.next.after`
- `searchLimit` (1–200, default 10) used when `returnAll` is false

#### Batch operations
- All accept a raw JSON body (pre-filled with a relevant example)
- No Additional Options; no inter-item delay
- Batch Delete calls `POST .../batch/archive` (HubSpot's archive endpoint)

### Helpers — `nodes/HubSpot/helpers.ts`
- `buildHubSpotUrl(base, path, params)` — builds URLs with proper repeated params for arrays
  (e.g. `?properties=email&properties=firstname` instead of `?properties[0]=email`)
- `fetchProperties()` (private) — the single source every property `loadOptions` method
  (`getProperties`, `getEnumerationProperties`, `getAllProperties`, `getSearchFilterProperties`)
  calls through. Filters out "(legacy)"-labelled properties everywhere, and additionally filters
  out `hs_createdate` / `hs_lastmodifieddate` when `objectType` is Contacts (`0-1`) — see the
  Contacts date-property quirk below.
- `getSearchFilterProperties` also injects `associations.0-<associationTypeId>` pseudo-properties
  (from `associationTypes.ts`) so Filter Groups can filter by an associated record's ID.
- `CONTACTS_OBJECT_TYPE` — exported constant (`'0-1'`) shared between `helpers.ts` and the Trigger
  node so both the dropdown filtering and the polling logic agree on which object type is Contacts.

### Shared search filter UI — `nodes/HubSpot/searchFilter.ts`
Used by both the Objects → Search operation and the Trigger node so their filter/sort UX stays in
lockstep:
- `searchFilterModeProperty` / `filterGroupsUiProperty` / `filterJsonProperty` — the Fields /
  Custom JSON toggle and the two filter-input variants
- `propertiesProperty`, `sortsUiOption`, `sortsJsonOption` — the Properties multi-select and Sorts
  fields
- `resolveSearchInput(params)` — resolves `filterGroups` / `sorts` / any extra search-body keys from
  whichever mode is active, and flags invalid JSON via `invalidFilterJson` / `invalidSortsJson`
  rather than throwing directly (callers decide how to surface the error)

### Association type table — `nodes/HubSpot/associationTypes.ts`
`ASSOCIATION_TYPES` — a per-object-type table of `[associationTypeId, label]` pairs used to build
the `associations.0-<id>` pseudo-property options in `getSearchFilterProperties`.

### Trigger node — `nodes/HubSpot/HubspotApiTrigger.node.ts`
Fully implemented polling trigger. `objectType` (same dropdown as Objects) + `triggerOn`:
- **New Records** / **Updated Records** / **New or Updated Records** — standard `lastmodifieddate`-
  (or `createdate`-) windowed search, same Filter Groups/Filters (JSON)/Sorts UI as Search, living
  in the main section.
- **Property Changed** — a top-level **Trigger Properties** multi-select (fires if any selected
  property changed value). Filter Groups/Filters (JSON) move into **Additional Options** (a
  single-instance `fixedCollection` named "Search Filters", so one "Add Search Filters" click
  reveals the mode toggle + both filter editors together — a bare `collection` would otherwise
  require adding each one separately). Since HubSpot's Search API can't filter by *which* property
  changed, `poll()` re-reads search candidates via `POST .../batch/read` with
  `propertiesWithHistory`, chunked in groups of 100, and only keeps records where a watched
  property's most recent history entry falls within the poll window. Each emitted record gets a
  `changedProperties: [{ propertyName, value, timestamp }]` array. Manual "fetch test event" runs
  skip the window check (any prior change validates the property selection) — same "skip time
  filtering in manual mode" convention as the other trigger modes.
- Poll-window filter values are ISO 8601 strings with a UTC offset (`toIsoStringWithOffset()`),
  not raw epoch ms.
- **Contacts date-property quirk**: Contacts doesn't accept `hs_createdate` / `hs_lastmodifieddate`
  as search/sort properties, only the unprefixed `createdate` / `lastmodifieddate`. `poll()` derives
  `createDateProperty` / `lastModifiedDateProperty` based on `objectType === CONTACTS_OBJECT_TYPE`
  and uses those wherever it builds a time filter or default sort. Every other object type keeps
  the `hs_`-prefixed versions.
- `staticData.lastPollTime` (workflow static data) tracks the last successful poll; falls back to
  "1 minute ago" if missing. Manual mode skips the poll-window filter entirely so the test run
  validates filters/properties against all matching records, not just the last window.

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

Associations, Owners, and Properties resources, plus the polling Trigger (including its Property
Changed mode), are all implemented — see `descriptions/AssociationDescription.ts`,
`descriptions/OwnerDescription.ts`, `descriptions/PropertyDescription.ts`, and
`HubspotApiTrigger.node.ts` above. Remaining suggestions:

1. **Lists resource** — HubSpot lists API.
2. **Events resource** — HubSpot events API.

---

## Dev commands

```bash
npm run build    # compile TypeScript → dist/
npm run lint     # run n8n linter (strict mode)
npm run dev      # start n8n dev server with hot reload at http://localhost:5678
```

Build output goes to `dist/nodes/HubSpot/` (matches the real `nodes/HubSpot/` source folder casing).
`package.json`'s `n8n.nodes` / `n8n.credentials` paths point there; the individual file basenames
are lowercase-s (`HubspotApi.node.js`, `HubspotApiTrigger.node.js`, `HubspotApi.credentials.js`) to
match their class names, per n8n's file-naming lint rule.
