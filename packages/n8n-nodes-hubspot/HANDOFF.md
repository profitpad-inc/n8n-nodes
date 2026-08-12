# HubSpot n8n Node — Handoff

## What this is

A custom n8n community node (`@profitpad-inc/n8n-nodes-hubspot`) for the HubSpot CRM API.

**Package path:** `packages/n8n-nodes-hubspot`
**Nodes in n8n:** `HubSpot` (action node, internal name `hubspotApi`) and `HubSpot Trigger`
(internal name `hubspotApiTrigger`)
**API docs:** https://developers.hubspot.com/docs/api-reference/latest/crm/using-object-apis

Every change so far is listed under a single **Unreleased** heading in `CHANGELOG.md`; the
released version in `package.json` is `0.1.43`.

---

## File map

| File | What lives there |
|---|---|
| `nodes/HubSpot/HubspotApi.node.ts` | The action node: resource/operation routing and all `execute()` logic |
| `nodes/HubSpot/HubspotApiTrigger.node.ts` | The polling trigger node (properties + `poll()`) |
| `nodes/HubSpot/HubspotApi.credentials.ts` | Access token credential |
| `nodes/HubSpot/helpers.ts` | Object type table, URL builder, all `loadOptions` methods, property cache, owner/user lookup helpers |
| `nodes/HubSpot/searchFilter.ts` | Shared Fields / Custom JSON search-filter UI and its resolver |
| `nodes/HubSpot/associationTypes.ts` | `ASSOCIATION_TYPES` — per-object-type `[associationTypeId, label]` table |
| `nodes/HubSpot/descriptions/ObjectDescription.ts` | Objects resource UI (largest file) |
| `nodes/HubSpot/descriptions/AssociationDescription.ts` | Associations resource UI |
| `nodes/HubSpot/descriptions/OwnerDescription.ts` | Owners resource UI (Users + Owners branches) |
| `nodes/HubSpot/descriptions/PropertyDescription.ts` | Properties resource UI |

Base paths, all defined at the top of `HubspotApi.node.ts`:

| Constant | Value |
|---|---|
| `HUBSPOT_BASE` | `https://api.hubapi.com` |
| `OBJECTS_BASE_PATH` | `/crm/v3/objects` |
| `ASSOC_BASE_PATH` | `/crm/associations/2026-03` |
| `PROPERTIES_BASE_PATH` | `/crm/properties/2026-03` |
| `USERS_OBJECT_PATH` | `/crm/v3/objects/users` |
| `OWNERS_BASE_PATH` (helpers) | `/crm/v3/owners` |

---

## Current state (working)

### Credentials — `HubspotApi.credentials.ts`
- Single **Access Token** field (password type) — user pastes a HubSpot Private App token
- Bearer auth injected via `IAuthenticateGeneric`:
  ```ts
  Authorization: '={{"Bearer " + $credentials.accessToken}}'
  ```
- Credential test: `GET https://api.hubapi.com/crm/v3/objects/contacts?limit=1`
- Icon: `file:app-icon.svg`

### Node-wide conventions — `HubspotApi.node.ts`
- Auth: always `httpRequestWithAuthentication('hubspotApi', ...)` — credentials inject the header
- `BASE_HEADERS` (`content-type` / `accept: application/json`) on every request
- Bodies are always `JSON.stringify`-ed; `parseJsonParam()` accepts either a JSON string or an
  already-parsed object from an expression
- One `try`/`catch` wraps each input item: `continueOnFail()` pushes `{ error: message }`,
  otherwise the error is re-thrown as `NodeApiError` with `itemIndex`
- Most operations expose **Milliseconds Between Items** (default 50ms) via their Additional
  Options; the delay is applied after each item except the last (`delayMs` variable)
- Every output item carries `pairedItem: { item: i }`

### Resources
Four resources, selected by the top-level **Resource** dropdown: **Associations**, **Objects**
(default), **Owners**, **Properties**.

---

## Resource: Objects

One resource covers all HubSpot CRM object types via a single **Object Type** dropdown
(`typeOptions: { noValidation: true }`, so expressions and hand-typed values pass through).
The option list is `OBJECT_TYPE_OPTIONS` in `helpers.ts`.

### Object types

Every entry is a HubSpot type ID; the label carries the ID too (e.g. `Notes (0-46)`).

| Display name | Value | Display name | Value |
|---|---|---|---|
| Calls | `0-48` | Orders | `0-123` |
| Carts | `0-142` | Payments | `0-101` |
| Communications | `0-18` | Postal Mail | `0-116` |
| Companies | `0-2` | Products | `0-7` |
| Contacts | `0-1` | Projects | `0-970` |
| Contracts | `0-721` | Quotes | `0-14` |
| Deals | `0-3` | Services | `0-162` |
| Emails | `0-49` | Subscriptions | `0-69` |
| Invoices | `0-53` | Tasks | `0-27` |
| Leads | `0-136` | Tickets | `0-5` |
| Line Items | `0-8` | Users | `0-115` |
| Meetings | `0-47` | | |
| Notes | `0-46` | | |

`ASSOCIATION_OBJECT_TYPE_OPTIONS` is the same list minus Users (`0-115`), since Users aren't
associable records.

### Operations

| Operation | Method | URL |
|---|---|---|
| Get | GET | `/crm/v3/objects/{objectType}/{objectId}` |
| List | GET | `/crm/v3/objects/{objectType}` |
| Create | POST | `/crm/v3/objects/{objectType}` |
| Update | PATCH | `/crm/v3/objects/{objectType}/{objectId}` |
| Upsert | POST | `/crm/v3/objects/{objectType}/batch/upsert` (single input) |
| Delete | DELETE | `/crm/v3/objects/{objectType}/{objectId}` |
| Merge | POST | `/crm/v3/objects/{objectType}/merge` |
| Search | POST | `/crm/v3/objects/{objectType}/search` |
| Batch Read | POST | `/crm/v3/objects/{objectType}/batch/read` |
| Batch Create | POST | `/crm/v3/objects/{objectType}/batch/create` |
| Batch Update | POST | `/crm/v3/objects/{objectType}/batch/update` |
| Batch Upsert | POST | `/crm/v3/objects/{objectType}/batch/upsert` |
| Batch Delete | POST | `/crm/v3/objects/{objectType}/batch/archive` |

**Merge** is offered only for `MERGE_ELIGIBLE_TYPES` (`0-1`, `0-2`, `0-3`, `0-5` — Contacts,
Companies, Deals, Tickets). There are two Operation dropdown definitions in
`ObjectDescription.ts` for exactly this reason: one shown for merge-eligible types (includes
Merge), one for everything else. **Both lists must be kept in sync when an operation is added.**

#### Get
Top-level **Properties** multi-select; Additional Options: `propertiesWithHistory`,
`associations`, `idProperty`, `archived`, `errorWhenNotFound`, `millisecondsBetweenItems`

- `idProperty` — look up by a property value (e.g. `email`) instead of the record ID
- `errorWhenNotFound` (default `true`) — when `false`, a 404 returns `{ objectFound: false }`
  instead of throwing. On success, `objectFound: true` is merged into the response.
- 404 detection checks both `error.httpCode === '404'` (NodeApiError) and
  `error.response?.status === 404` (raw axios)
- **Legacy fallback**: Properties used to live inside Additional Options. The code reads the
  top-level value first and falls back to `opts.properties` so old workflows keep working. The
  same fallback exists on List. Don't remove it.

#### List
- `returnAll: false` — single request, respects `limit` (1–100, default 50); returns the raw
  HubSpot response as one item
- `returnAll: true` — paginates via `paging.next.after` up to **Max Pages** (`minValue: 1`,
  integer, also clamped with `Math.max(1, Math.floor(...))`), 100 per page, and honours
  **Return All Mode**: `allInOne` (one item, `{ results: [...] }`), `eachPage` (raw page per
  item), `eachResult` (one item per record)
- Additional options: `properties` (legacy), `propertiesWithHistory`, `associations`, `after`
  cursor, `archived`, `millisecondsBetweenItems`

#### Create
- **Input Mode** toggle: **Fields** (a `fixedCollection` of `name`/`value` property pairs) or
  **Custom JSON** (a raw properties object)
- Associations can be attached at create time, in the matching mode: a `fixedCollection` of
  To Object ID / To ID Property / Association Type IDs / Association Category in Fields mode,
  or a raw associations array in Custom JSON mode. When **To ID Property** is set, the target
  type is derived from the chosen association label via `getAssociationTargetObjectType()` and
  a GET resolves the property value to a real record ID before the create.
- **Notes default `hs_timestamp`**: HubSpot rejects a Note create without `hs_timestamp`, so
  when the object type is Notes (`isNotesObjectType()` matches `0-46`, `notes`, or `note` —
  the dropdown is `noValidation`, so hand-typed values reach it) and the property is missing,
  null, or blank, it is filled with `new Date().toISOString()`. An explicit value always wins.
  This applies to the single Create operation only, not Batch Create, which takes a raw body.

#### Update
- Same **Input Mode** toggle as Create
- Additional options: `idProperty` (match by property value instead of ID),
  `millisecondsBetweenItems`

#### Upsert
- HubSpot has no single-record upsert endpoint, so this posts one input to `/batch/upsert` and
  returns `response.results[0]` unwrapped (falling back to the whole response)
- **ID Property** is a required top-level field, not an additional option: an upsert can't
  create a record against a record ID that doesn't exist yet, so Record ID isn't offered. An
  empty value throws a `NodeOperationError` explaining the two ways forward (create a unique
  property in HubSpot, or use Create). `getUpsertIdProperties` returns a single
  "No Unique Properties Available" entry for object types with no unique properties.

#### Delete
- Additional options: `idProperty`, `millisecondsBetweenItems`
- With `idProperty`: a GET resolves the value to a real record ID first, then DELETE runs
  against that ID. Response: `{ success: true, id: "<realId>" }`
- HubSpot DELETE returns 204 No Content

#### Merge
- **Primary Object ID**, a comma-separated **Object IDs to Merge**, and a
  **Preserve From Primary** property multi-select
- Three steps: (1) GET the primary's values for the preserved properties *before* merging,
  (2) merge each secondary into the current primary sequentially, following the surviving `id`
  returned by each call, (3) PATCH the preserved values back onto the survivor
- Output: the last merge response plus `survivingId`

#### Search
- Uses the shared **Search Filter Mode** UX from `searchFilter.ts`: Fields / Custom JSON
  toggle, guided AND/OR **Filter Groups** builder with a type-aware operator dropdown, a
  **Properties** multi-select, and **Sorts** / **Sorts (JSON)** under Additional Options
- Additional options also include a free-text **Query** and `millisecondsBetweenItems`
- `returnAll` paginates with `limit: 100` per page plus **Max Pages**; otherwise `searchLimit`
  (1–200, default 10) applies

#### Batch Read
- **Fields** mode: comma-separated **Object IDs**, chunked into batches of 100 automatically —
  no Return All / Limit / Max Pages. **Output Mode** (`allInOne` / `eachPage` / `eachResult`)
  is always shown; its parameter name is still `batchReadReturnAllMode` from when it was
  labelled "Return All Mode", so workflows saved when the field was hidden now follow the
  stored value (default `eachResult`).
- **Custom JSON** mode: raw body
- Additional options: `properties`, `propertiesWithHistory`, `idProperty`,
  `millisecondsBetweenItems`

#### Batch Delete
- **Fields / Custom JSON** toggle; Custom JSON (raw **Body**) is the default so saved
  workflows are unaffected, and returns `{ success: true }`
- Fields mode: comma-separated **Object IDs** chunked into batches of 100, an **Output Mode**
  control for how deleted IDs come back, and `idProperty` / `millisecondsBetweenItems` under
  Additional Options
- The archive endpoint only accepts record IDs, so when **ID Property** is set each chunk is
  resolved through a `batch/read` first; values with no matching record are reported back as
  `notFound` instead of being archived

#### Batch Create / Batch Update / Batch Upsert
- Raw JSON body (pre-filled with a relevant example), no Additional Options, no inter-item
  delay

---

## Resource: Associations

Endpoints hang off `/crm/associations/2026-03/{fromObjectType}/{toObjectType}`. **From Object
Type** and **To Object Type** use `ASSOCIATION_OBJECT_TYPE_OPTIONS` (no Users).

| Operation | Value | Method | URL suffix |
|---|---|---|---|
| Batch Read | `assocBatchRead` | POST | `/batch/read` |
| Batch Create Default | `assocBatchCreateDefault` | POST | `/batch/associate/default` |
| Batch Create Labeled | `assocBatchCreateLabeled` | POST | `/batch/create` |
| Batch Delete | `assocBatchDelete` | POST | `/batch/archive` |
| Read Labels | `assocReadLabels` | GET | `/labels` |

- **Batch Read** is the only one with a Fields-style input: comma-separated **From IDs** plus an
  optional **From ID Property**. With an ID property set, values are resolved to record IDs via
  `POST /crm/v3/objects/{fromObjectType}/batch/read` in chunks of 100; the association reads
  themselves are chunked at 1000. An empty ID list short-circuits to
  `{ status: 'COMPLETE', results: [], numErrors: 0 }` instead of calling HubSpot.
- The other operations take a raw JSON **Body**. Batch Delete returns `{ success: true }`.
- The node subtitle shows `operation: fromObjectType → toObjectType` for this resource.

---

## Resource: Owners

**Object Type** here is not a CRM type ID — it's `users` or `owners`, picking an API branch:

| Object Type | Operations | Endpoint |
|---|---|---|
| Users | Get, List, Search, Update | `/crm/v3/objects/users` |
| Owners | Get, List | `/crm/v3/owners` |

- **ID Property** is a top-level dropdown whose options differ per branch: Users offers
  `userId` / `ownerId` / `email`, Owners offers `ownerId` / `userId` / `email`.
- `resolveUsersLookup()` (helpers) turns an ID-property choice plus a value into
  `{ realId, idPropertyParam }` for the Users endpoint; `findOwnerByField()` scans the Owners
  endpoint for a matching field.
- **Cross-linking**: a Users result gets its matching owner attached as `owner`, and an Owners
  result gets its matching user attached, via `fetchLinkedOwner()` / `fetchLinkedUser()`. A
  failed lookup yields `null` rather than an error.
- `USERS_ALWAYS_INCLUDED_PROPERTIES` (`hs_internal_user_id`, `hs_searchable_calculated_name`,
  `hs_family_name`, `hs_given_name`, `hs_email`) is always unioned into the requested
  properties for Users, so the cross-link and display fields are present.
- Users Search takes a raw **Search Body** (pre-filled example filters on `hs_job_title`),
  paginates at `limit: 200` per page with **Max Pages** and the same three-way **Return All
  Mode**, and throws "No users found matching the search criteria" when
  `errorWhenNotFound` is on and nothing matched.
- Get supports `errorWhenNotFound` → `{ objectFound: false }`, same convention as Objects → Get.
- `USERS_OBJECT_TYPE` (`'0-115'`) exists in helpers because the Properties API needs the real
  type ID when this resource's dropdown says `users`.

---

## Resource: Properties

Endpoints hang off `/crm/properties/2026-03/{objectType}` (Object Type is a real type ID here).

| Operation | Value | Method | URL |
|---|---|---|---|
| Get Property | `getProperty` | GET | `/{propertyName}` |
| List Properties | `listProperties` | GET | `/` |
| List Property Groups | `listPropertyGroups` | GET | `/groups` |
| Update Property Label | `updatePropertyLabel` | PATCH | `/{propertyName}` |
| Update Dropdown Options | `updateDropdownOptions` | PATCH | `/{propertyName}` |

- **Update Property Label** sends `label`, plus `description` when supplied
- **Update Dropdown Options** has an **Update Mode**: `add` (GET current options, drop any
  whose value collides, append the provided ones), `remove` (GET current, filter out the
  comma-separated **Values to Remove**), `overwrite` (send exactly what was provided). All
  three end in a single PATCH with the full `options` array, because HubSpot replaces the whole
  list.

---

## Shared building blocks

### Helpers — `helpers.ts`
- `buildHubSpotUrl(base, path, params)` — builds URLs with repeated params for arrays
  (`?properties=email&properties=firstname`, not `?properties[0]=`). Skips `undefined`, `''`,
  and `false` values.
- `fetchProperties()` (private, cached) — the single source every property `loadOptions` method
  goes through: `getProperties`, `getEnumerationProperties`, `getAllProperties`,
  `getWritableProperties`, `getUniqueProperties`, `getUpsertIdProperties`,
  `getSearchFilterProperties`, `getUserProperties`, `getWritableUserProperties`,
  `getUniquePropertiesForAssociationFrom` / `To`. Filters out "(legacy)"-labelled properties
  everywhere, and additionally `hs_createdate` / `hs_lastmodifieddate` for Contacts (`0-1`) —
  see the Contacts quirk below.
- Property cache: keyed by credential + object type, `PROPERTIES_CACHE_TTL_MS` = 2 minutes, so
  a property added in HubSpot shows up without an n8n restart. A failed fetch is evicted
  immediately.
- `getSearchFilterProperties` also injects `associations.0-<associationTypeId>`
  pseudo-properties (from `associationTypes.ts`) so Filter Groups can filter on an associated
  record's ID.
- `getAssociationTypeIds` / `getAssociationTargetObjectType` — the second derives the target
  object type from an association label ("Note to contact" → `0-1`) so the To Object Type never
  has to be asked for twice. Returns `''` for target kinds with no dropdown entry (e.g.
  Appointments), which just means the ID Property lookup isn't offered there.
- `resolveUserIdFromOwnerId`, `findOwnerByField`, `resolveUsersLookup` — the Owners/Users
  lookup helpers described above.
- Exported constants: `CONTACTS_OBJECT_TYPE` (`'0-1'`), `USERS_OBJECT_TYPE` (`'0-115'`),
  `NOTES_OBJECT_TYPE` (`'0-46'`) + `isNotesObjectType()`, `OBJECT_TYPE_OPTIONS`,
  `ASSOCIATION_OBJECT_TYPE_OPTIONS`, `OWNERS_BASE_PATH`, `SEARCH_OPERATORS`.
- `getSearchOperators` narrows the operator list to the selected property's type
  (`operatorsForPropertyType`), falling back to the full list when the type can't be resolved.

### Shared search filter UI — `searchFilter.ts`
Used by both Objects → Search and the Trigger so their filter/sort UX stays in lockstep:
- `searchFilterModeProperty` / `filterGroupsUiProperty` / `filterJsonProperty` — the Fields /
  Custom JSON toggle and the two filter-input variants
- `propertiesProperty`, `sortsUiOption`, `sortsJsonOption` — the Properties multi-select and
  Sorts fields
- `buildFilterFromUi` / `buildFilterGroupsFromUi` / `buildSortsFromUi` — UI → API body
- `resolveSearchInput(params)` — resolves `filterGroups` / `sorts` / extra search-body keys from
  whichever mode is active, and flags bad JSON via `invalidFilterJson` / `invalidSortsJson`
  rather than throwing (callers decide how to surface it)
- `toStringList(value)` — the everywhere-used "string, array, or comma-separated" normalizer
- `VALUELESS_OPERATORS` — `HAS_PROPERTY` / `NOT_HAS_PROPERTY`, which take no value

### Association type table — `associationTypes.ts`
`ASSOCIATION_TYPES` — per-object-type `[associationTypeId, label]` pairs, used for the
Association Type IDs dropdowns, the `associations.0-<id>` pseudo-properties, and target-type
inference.

---

## Trigger node — `HubspotApiTrigger.node.ts`

Polling trigger. **Object Type** (its own inline copy of the object type list — currently
identical to `OBJECT_TYPE_OPTIONS`, but **not** imported from helpers, so both need updating
when a type is added) plus **Trigger On**:

- **New Records** / **Updated Records** / **New or Updated Records** — a `createdate`- or
  `lastmodifieddate`-windowed search using the same Filter Groups / Filters (JSON) / Sorts UI
  as Objects → Search, in the main section.
- **Property Changed** — a top-level **Trigger Properties** multi-select (fires if any selected
  property changed value). Filter Groups / Filters (JSON) move into **Additional Options**, as
  a single-instance `fixedCollection` named "Search Filters", so one "Add Search Filters" click
  reveals the mode toggle and both filter editors together (a bare `collection` would require
  adding each separately). Since HubSpot's Search API can't filter by *which* property changed,
  `poll()` re-reads candidates via `POST .../batch/read` with `propertiesWithHistory`, chunked
  in groups of 100, and keeps only records where a watched property's most recent history entry
  falls inside the poll window. Each emitted record gets
  `changedProperties: [{ propertyName, value, timestamp }]`.
- **Return Mode** (`allInOne` / `eachResult`) and **Max Pages Per Poll** control output shape
  and pagination.
- Poll-window filter values are ISO 8601 strings with a UTC offset (`toIsoStringWithOffset()`),
  not raw epoch ms, and the window filter is injected **only during automatic polling** —
  manual "fetch test event" runs skip it (and skip the Property Changed window check) so the
  test validates the configured filters against all matching records.
- Default sort when none is given: `hs_lastmodifieddate` descending, or `lastmodifieddate` for
  Contacts.
- `staticData.lastPollTime` tracks the last successful poll, falling back to "1 minute ago".
- When n8n runs on localhost, the exact request body sent to HubSpot is logged via the node
  logger to aid debugging.

---

## Key technical notes

- **URL pattern**: `/crm/v3/objects/{objectType}` works for both numeric IDs (`0-1`) and string
  names (`contacts`, `users`). The named path `/crm/v3/contacts` returned 404 for this account.
  The dropdowns standardised on numeric IDs; only the Owners resource still uses the string
  `users` path.
- **Contacts date-property quirk**: Contacts does not accept `hs_createdate` /
  `hs_lastmodifieddate` as search/sort properties, only the unprefixed `createdate` /
  `lastmodifieddate`. Filtered out of dropdowns in `fetchProperties`, and the Trigger derives
  `createDateProperty` / `lastModifiedDateProperty` from
  `objectType === CONTACTS_OBJECT_TYPE`. Every other object type keeps the `hs_` prefix.
- **Notes require `hs_timestamp`** — see Objects → Create above.
- **Auth expression**: `={{"Bearer " + $credentials.accessToken}}` is the correct n8n
  expression syntax for `IAuthenticateGeneric`. The `{{...}}` form (without `=`) sends a
  literal string.
- **Array query params**: HubSpot expects repeated params, not indexed ones; `buildHubSpotUrl`
  handles this via `URLSearchParams.append`.
- **Linter rule** `@n8n/community-nodes/no-http-request-with-manual-auth` — always
  `httpRequestWithAuthentication`, never `httpRequest`, when credentials are involved.
- **Linter rule** `@n8n/community-nodes/no-restricted-globals` — the inter-item `setTimeout`
  needs an inline eslint-disable (see the bottom of `execute()`).
- **NodeApiError wrapping**: `httpRequestWithAuthentication` throws `NodeApiError`, not raw
  axios errors, so 404 checks use `error.httpCode === '404'` (string). Re-thrown errors must be
  wrapped in `new NodeApiError(this.getNode(), error, { itemIndex: i })` or the linter
  complains.
- **noValidation on Object Type**: `typeOptions: { noValidation: true }` suppresses n8n's
  "value not in options" warning when expressions are used — which also means any string can
  reach `execute()`, so object-type comparisons should tolerate hand-typed values.
- **Two Operation dropdowns** in `ObjectDescription.ts` (merge-eligible vs not) must stay in
  sync.
- **Legacy parameter locations** are read as fallbacks (Properties in Additional Options on
  Get/List; `batchReadReturnAllMode` kept as Batch Read's Output Mode parameter name). Keep
  them. The shared `returnAllMode` parameter is used by Objects → List, Objects → Search, and
  both Owners list/search branches.

---

## What's next (suggested)

Objects, Associations, Owners, and Properties resources plus the polling Trigger (including
Property Changed mode) are all implemented. Remaining ideas:

1. **Lists resource** — HubSpot lists API.
2. **Events resource** — HubSpot events API.
3. Import the Trigger's object type list from `OBJECT_TYPE_OPTIONS` instead of duplicating it.

---

## Dev commands

```bash
npm run build    # compile TypeScript → dist/
npm run lint     # run n8n linter (strict mode)
npm run dev      # start n8n dev server with hot reload at http://localhost:5678
```

Per `AGENTS.md`, don't run the dev n8n instance to test — leave testing to the user.

Build output goes to `dist/nodes/HubSpot/` (matching the real `nodes/HubSpot/` source folder
casing). `package.json`'s `n8n.nodes` / `n8n.credentials` paths point there; the individual
file basenames are lowercase-s (`HubspotApi.node.js`, `HubspotApiTrigger.node.js`,
`HubspotApi.credentials.js`) to match their class names, per n8n's file-naming lint rule.
