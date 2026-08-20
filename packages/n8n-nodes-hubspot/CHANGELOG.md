# Changelog

## Unreleased

### HubSpot (Forms → new resource)

- Added a **Forms** resource to the HubSpot action node with two operations:
  **Get All Forms** (pages through `GET marketing/v3/forms` with
  `formTypes=all` via `after` until exhausted, returning every form as a
  separate output item) and **Get Form Submissions** (`GET
  form-integrations/v1/submissions/forms/{formGuid}`, the same legacy endpoint
  used by the Trigger's Form Submitted option).
- **Get Form Submissions** follows the same **Return All** / **Limit** /
  **Max Pages** / **Return All Mode** convention as Objects → List and Owners
  → List, since this endpoint does support real `after`-cursor pagination,
  capped at 50 results per page.
- **Form** is the same `getForms`-backed dropdown used by the Trigger.
- Every returned submission gets a `fields` object added — its `values`
  array flattened to `{ "<objectTypeId>__<name>": value }` (e.g.
  `"0-1__email": "a@b.com"`) via the shared `buildFormSubmissionFields()`
  helper, same as the Trigger's Form Submitted option. A multi-value field
  (e.g. a checkbox group) submits one `values` entry per checked option
  under the same name — those are joined with `;` rather than the last one
  silently overwriting the rest.

### HubSpot Trigger (Trigger On → new "Form Submitted" option)

- The HubSpot Trigger node's **Trigger On** field gained a 5th option, **Form
  Submitted**, which polls a single HubSpot form for new submissions using
  the legacy `form-integrations/v1/submissions/forms` endpoint (HubSpot has
  not replaced this API, and it has no built-in since/after-a-date filter).
  There is no separate "Resource" field — n8n's node-insertion "actions"
  panel builds a trigger node's quick-add list from the *first* property in
  the array named "Event"/"Events"/"Trigger On", and lists only that
  property's options; a `resource` field plus a second, resource-gated
  "Trigger On"-named field for Forms (tried first) is invisible to it, since
  the earlier CRM-Records field always wins that lookup. Folding **Form
  Submitted** directly into the one real **Trigger On** field is what
  actually makes it discoverable there. **Object Type** is hidden via
  `displayOptions.hide.triggerOn: ['formSubmitted']` for this option; every
  CRM-only field is scoped to the other 4 `triggerOn` values instead of the
  removed `resource: ['objects']`.
- **Form** is a dropdown sourced from `marketing/v3/forms`, paginated via
  `after` with `formTypes=all` so every form in the account is offered, not
  just marketing-type forms capped at a default page size (the same
  `getForms` loadOptions used by the Forms resource on the action node).
- Since the submissions endpoint only supports `limit` / `after` paging and
  always returns newest-first, polling pages forward from the top and stops
  as soon as it reaches a submission at or before the last poll time (or
  **Max Pages Per Poll** is hit), then reverses the matches to chronological
  order before output.
- Manual "fetch test event" runs skip the poll-window check entirely (same
  convention as the CRM Records branch) and only request the 5 most recent
  submissions — enough to confirm the Form selection without pulling a full
  page. Automatic polling is unaffected: it still returns everything that
  happened in the poll window, capped only by **Max Pages Per Poll**.
- Each matched submission gets a `fields` object added (see above), added
  before the contact/associations enrichment below so it's present
  regardless of whether a contact was found.
- Each matched submission is enriched with the contact it belongs to. Rather
  than assuming an `email` field exists, the first two *distinct* values
  tagged `objectTypeId: '0-1'` (Contacts) in submission order are used (just
  the one if the form only has a single contact field) — e.g. firstname +
  lastname for a form with no email field. Those are AND'd together as `EQ`
  filters in a `POST /crm/v3/objects/0-1/search` call (`limit: 1`) to find
  the contact, attached as `contact`; no contact-scoped values at all, or no
  match, means no `contact` key. When a contact is found and the submission
  has values tagged with any other `objectTypeId` (e.g. a deal-scoped
  field), each of those object types' records associated to the contact are
  looked up via the CRM batch associations endpoint (`POST
  /crm/associations/2026-03/0-1/{objectTypeId}/batch/read`) — the submitted
  value itself is never trusted as a real record ID — and attached as
  `associations: { [objectTypeId]: string[] }`.
- **Return Mode** (`allInOne` / `eachResult`) is shared with the CRM Records
  branch and controls output shape the same way for both.

### HubSpot (Objects → Create)

- Creating a **Note** without `hs_timestamp` no longer fails. When the object
  type is Notes and the property is missing or blank, it is filled with the
  current time (ISO 8601). An explicitly supplied value is always used as-is.
  Applies to both Fields and Custom JSON input modes, and to the single Create
  operation only, since Batch Create takes a raw body.

### HubSpot (Objects → Upsert)

- Added a single-record **Upsert** operation, laid out like the single Update
  operation (Object ID, Input Mode with Fields / Custom JSON, Properties,
  Additional Options) with **ID Property** promoted to a top-level field rather
  than an additional option.
- HubSpot has no single-record upsert endpoint, so the operation posts to
  `/batch/upsert` with a single input and returns the one result unwrapped from
  the batch response.
- **ID Property** is required and does not offer Record ID, since an upsert
  cannot create a record against an ID that does not exist yet. Object types
  with no unique properties show a single "No Unique Properties Available"
  entry pointing at the two ways forward: create a unique property in HubSpot,
  or use the Create operation.

### HubSpot (Objects → Batch Read)

- Removed **Return All**, **Limit**, and **Max Pages** from Fields mode. Every
  object ID provided is now read, chunked into batches of 100 automatically.
- **Return All Mode** is renamed to **Output Mode** and is always shown. The
  underlying parameter name is unchanged, so a mode picked in a saved workflow
  is preserved. Note that workflows saved with Return All *off* never showed
  this field and were hard-coded to one item per batch; they now follow the
  stored value, which defaults to **Each Result as 1 Item**.

### HubSpot (Objects → Batch Delete)

- The Batch Delete operation now has a **Fields / Custom JSON** input mode
  toggle, matching Batch Read. Custom JSON keeps the existing raw **Body**
  field and stays the default, so saved workflows are unaffected.
- Fields mode takes a comma-separated **Object IDs** list and chunks it into
  batches of 100 automatically. Every provided ID is deleted, with an **Output
  Mode** control for how the deleted IDs are returned, plus **ID Property** and
  **Milliseconds Between Items** under Additional Options.
- The HubSpot archive endpoint only accepts record IDs, so when **ID Property**
  is set each batch is resolved through a batch read request first. Values with
  no matching record are reported back under `notFound` instead of being
  archived.

### HubSpot (Objects → Search)

- The object Search operation now uses the same **Search Filter Mode** UX as the
  Trigger: a Fields / Custom JSON toggle, the guided AND/OR **Filter Groups**
  builder (with property lookup and association pseudo-properties), a type-aware
  operator dropdown, a **Properties** multi-select, and **Sorts** / **Sorts
  (JSON)** under Additional Options.
- Added a **Query** option (free-text search) and a **Limit** field (up to 200)
  for non-Return-All searches. The old raw **Search Body** JSON field is
  replaced by the above (raw JSON is still available via Custom JSON mode).

### HubSpot Trigger

- Added a **Search Filter Mode** toggle (Fields / Custom JSON).
- **Fields mode**: a guided AND/OR filter builder (labelled "Filter Groups",
  OR'd across groups, AND'd within each group) with a live property lookup for
  the selected object type. The property picker also includes
  `associations.0-<associationTypeId>` pseudo-properties (from the HubSpot-defined
  association type table) so records can be filtered by an associated record ID.
- **Fields mode**: the operator dropdown is filtered to only the operators valid
  for the selected property's type (e.g. In List is hidden for number
  properties). Falls back to the full operator list if the property type cannot
  be resolved.
- **Custom JSON mode**: a `Filters (JSON)` field plus a `Sorts (JSON)` field
  (under Additional Options), pre-filled with example `filterGroups` and `sorts`
  bodies. Replaces the single free-form Search Body field.
- Sorts moved into **Additional Options**; **Properties** (top-level) is now a
  multi-select dropdown with property lookup and expression support.
- Removed the **Properties With History** option — HubSpot's search endpoint
  does not support returning property history, so it never had any effect.
- The automatic time-based poll filter is now injected **only during automatic
  (production) polling**. Manual "fetch test event" runs skip it so the test
  validates the configured filters against all matching records.
- Default sort (when none is specified) is now **hs_lastmodifieddate
  descending**, except for **Contacts**, which uses **lastmodifieddate** (see
  Contacts date-property note below).
- The injected poll-window filter values are now sent as **ISO 8601 strings
  with a UTC offset** (e.g. `2026-07-21T21:17:08-04:00`) instead of raw epoch
  milliseconds.
- When n8n runs on localhost, the exact request body sent to HubSpot is logged
  (via the node logger) to aid debugging.
- Added a **Property Changed** trigger mode. A new top-level **Trigger
  Properties** multi-select picks one or more properties to watch; the trigger
  fires if any of them changed value during the poll window. Since HubSpot's
  Search API can't filter by *which* property changed, candidates found by the
  usual `lastmodifieddate`-based search are re-read via `batch/read` with
  `propertiesWithHistory`, and only kept if one of the watched properties'
  history shows a change timestamped within the poll window. Each emitted
  record includes a `changedProperties` array (`propertyName`, `value`,
  `timestamp`). Manual "fetch test event" runs skip the window check, only the
  Trigger Properties selection is validated.
- For **Property Changed** mode, **Filter Groups** / **Filters (JSON)** move
  into **Additional Options** (behind a single "Add Search Filters" click)
  instead of the main section, since Trigger Properties takes their place
  there. The other three trigger modes are unaffected.

### Shared

- Property dropdowns now exclude legacy properties (those with a "(legacy)"
  label, e.g. owneremail) across both the HubSpot and HubSpot Trigger nodes.
- The Fields/Custom-JSON search filter builder, operator lookup, sorts, and
  properties selector are now shared between both nodes.
- **Contacts date-property quirk**: unlike every other CRM object, Contacts
  does not accept the unified `hs_createdate` / `hs_lastmodifieddate`
  properties as search or sort properties, only the unprefixed `createdate` /
  `lastmodifieddate`. Property dropdowns (`fetchProperties` in `helpers.ts`)
  now exclude the `hs_` versions specifically for Contacts, and the Trigger's
  `poll()` now uses `createdate` / `lastmodifieddate` for Contacts wherever it
  builds a time filter or default sort.
- Fixed a file/folder casing bug: the two node source files and the
  credentials file were tracked in git under the wrong case relative to their
  class names (e.g. `HubSpotApi.node.ts` vs. class `HubspotApi`), which went
  unnoticed on case-insensitive filesystems (macOS) but would break loading on
  case-sensitive ones (Linux, most n8n deployments). Also fixed
  `package.json`'s `n8n.nodes` / `n8n.credentials` paths, which pointed at a
  `dist/nodes/Hubspot/` folder that never matched the real
  `dist/nodes/HubSpot/` output.
