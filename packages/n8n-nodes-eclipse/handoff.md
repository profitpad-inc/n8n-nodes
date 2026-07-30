# Handoff: n8n-nodes-eclipse

Read this first, before `.agents/*.md`. It's a snapshot of how this specific
package is built today, so you don't have to re-derive it from scratch every
session. The `.agents/*.md` docs are generic n8n node-building rules; this
file is project-specific context on top of those.

## What this is

A single package (`@profitpad-inc/n8n-nodes-eclipse`) inside the
`n8n-nodes` monorepo (`packages/*`). It's an n8n community node for the
**Epicor Eclipse API** (a distribution ERP). Sibling packages in the same
monorepo: `n8n-nodes-hubspot`, `n8n-nodes-friendgrid`,
`n8n-nodes-robust-scheduler` — unrelated to this one, but their commits and
version bumps show up interleaved in `git log` at the repo root. **Scope git
log to this package** with `git log -- .` (run from this directory) or
`git log -- packages/n8n-nodes-eclipse` from the repo root.

## Files

```
nodes/Eclipse/
  EclipseApi.node.ts           Main programmatic-style node (resource/operation model)
  EclipseApi.credentials.ts    Credential type: baseUrl, username, password
  EclipseApiTrigger.node.ts    Polling trigger node
  helpers.ts                   createSession, withRetry, applyFieldFilter
  descriptions/
    ContactDescription.ts      Contact: Get, Get Many
    CustomerDescription.ts     Customer: Create, Get, Get Many, Update
    ProductDescription.ts      Product: Get, Get Many, Product Inventory Pricing Inquiry
    SalesOrderDescription.ts   Sales Order: Create, Create Line Items, Create Shipment,
                                Delete Line Items, Get, Get Many, Get Order Change Log,
                                Update Internal Notes, Update Line Items Price,
                                Update Line Items Quantity, Update PO Number,
                                Update Ship Date, Update Ship Via,
                                Update Shipping Instructions, Update Status
```

This is a **programmatic-style** node (`execute()` is one big function with
`if (resource === ... && operation === ...)` blocks), not declarative. The
property *definitions* are still split out into `descriptions/*.ts` per
resource for readability, and spread into `EclipseApi.node.ts`'s
`properties` array. `EclipseApiTrigger.node.ts` defines its own properties
inline (it does not reuse the description files, since polling only needs
list/filter parameters, not the full CRUD parameter set).

## Auth model (important, not typical n8n credential auth)

Eclipse doesn't use a static API key/header. Auth is session-based:
1. `POST /Sessions` with `{ username, password }` → returns `sessionToken`.
2. Every subsequent request sends `sessionToken` as a plain header (not
   `Authorization: Bearer ...`).

Because the token is minted per-execution rather than being a static
credential value, it **cannot** go through n8n's normal
`httpRequestWithAuthentication` credential-injection flow for the session
call itself. `helpers.ts#createSession()` calls the plain
`this.helpers.httpRequest()` directly for `POST /Sessions`, retries up to 3
times, then every other API call in the node uses
`httpRequestWithAuthentication` with the session token manually merged into
`headers`. The credential's `test` request (in
`EclipseApi.credentials.ts`) hits the same `/Sessions` endpoint to validate
username/password.

## Sales Order ID format quirk

Sales order IDs are composite: `S2680001.0001` (order number + generation,
dot-separated). Several Update* operations (`updateStatus`,
`updateInternalNotes`) split this manually:
```ts
const dotIndex = rawId.indexOf('.');
const orderId = dotIndex !== -1 ? rawId.slice(0, dotIndex) : rawId;
const generationId = dotIndex !== -1 ? rawId.slice(dotIndex + 1).padStart(4, '0') : '';
```
If you add a new operation that takes a sales order ID and needs the
generation separately, follow this same pattern rather than inventing a new
one.

**Not every operation needs the split**, though: the LineItems sub-endpoints
(`createLineItem`, `updateLineItemPrice`, `updateLineItemQuantity`,
`deleteLineItem`) just pass the full `S2690635.0001`-style ID straight
through in the URL path, same as `updateShippingInstructions` /
`updatePONumber` / `updateShipVia` / `updateShipDate`. Only split it when the
API actually wants `orderId` and `generationId` as separate body/query
fields (as `updateStatus` and `updateInternalNotes` do).

## Sales Order line item sub-endpoints

`POST/PUT/DELETE .../SalesOrders/{id}/LineItems*` all take an **array** body
(even when updating a single line), each entry keyed by `lineId` (the line
item number as a string, e.g. `"1"` — not the product ID). `Create Line
Items` reuses the same `lineItemProduct` shape as Create Sales Order's
`lines` field (`defaultSalesOrderLinesJson`, exported from
`SalesOrderDescription.ts`, backs both). `Update Line Items Price` and
`Update Line Items Quantity` use a `fixedCollection` with
`typeOptions: { multipleValues: true }` in Fields mode (see
`updatePriceLines` / `updateQtyLines`) so a workflow can update several
lines in one call — mirrors the `types`/`shipToLists`/`contacts`
fixedCollection pattern already used in `CustomerDescription.ts`. `Delete
Line Items` is the odd one out in two ways: the underlying API only accepts
one `lineItemId` query param per request (not an array in the body), and it
still needs an empty `{}` JSON body sent regardless. Since the operation
needs to support deleting multiple lines, the "Line Item IDs" field takes a
comma-separated list and `execute()` loops, firing one sequential DELETE
request per ID — there's no bulk-delete endpoint to call instead.

## Field filtering (`applyFieldFilter` in helpers.ts)

Most `getMany`-style operations expose a "Fields to Return" mode
(`all` / `selected` / `except`) backed by `applyFieldFilter()`. `selected`
and `except` take comma-separated field lists and support dot notation for
nested paths (it walks/rebuilds the object tree, including arrays). `id` is
always force-included when using `selected` and never excludable when using
`except`. Reuse this helper for any new list operation rather than
reimplementing field filtering.

## Pagination pattern

Every `getMany`/poll operation follows the same shape: `pageSize` +
`startIndex`, `includeTotalItems=true` always set, and when "Return All" is
on, loop bumping `startIndex += pageSize` until a page comes back shorter
than `pageSize`. Copy this pattern for new list endpoints instead of
inventing pagination logic.

## Trigger node (`EclipseApiTrigger.node.ts`)

Polls on a schedule. Two lookback modes:
- **Rolling window** (default): looks back `pollInterval` minutes from now.
  Persists `lastRunTime` in workflow static data (`getWorkflowStaticData('node')`)
  so consecutive polls don't gap or duplicate; picks whichever of
  (`now - pollInterval`) or `lastRunTime` is *earlier*, so a workflow that
  was paused/off resumes from where it left off instead of losing data.
  Manual executions always use `now - pollInterval` (ignore `lastRunTime`)
  since there's no meaningful "last run" for a manual trigger.
- **Custom date mode** (`useCustomDate: true`): uses a fixed
  `updatedAfter` dateTime param directly, no static-data bookkeeping.

Returns `null` (not an empty array) when there are zero results, which is
the n8n convention for "nothing happened this poll."

## Known n8n editor quirk: "options" field value warnings

`options`/`multiOptions` type fields (e.g. Sales Order → Update Status →
Order Status) show an "Issues: The value ... is not supported!" warning in
the NDV whenever a live/pinned input item resolves the field's expression to
a value outside the declared option list. This was traced (by decompiling
the actual `n8n-editor-ui` bundle used by `n8n-node dev`, found under
`~/.npm/_npx/.../node_modules/n8n-editor-ui/dist/assets/ParameterInputList-*.js`)
to a hardcoded core n8n check — it applies to every `options`/`multiOptions`
field in every node, expression mode or not, and there is no property-level
flag to suppress it. **It's cosmetic only**: `execute()` doesn't run n8n's
built-in enum validation against `getNodeParameter(...)` results, so the
workflow runs correctly regardless of the warning.

For Sales Order → Update Status specifically, the underlying cause the user
actually cared about was case sensitivity: upstream systems (e.g. a CRM
field like `hs_deal.e_open_order_status`) often supply lowercase values like
`shipwhencomplete`, which don't match Eclipse's PascalCase enum
(`ShipWhenComplete`). Fixed by normalizing case-insensitively in
`execute()` before sending to the API: `salesOrderUpdateStatuses` is now
exported from `SalesOrderDescription.ts` (shared with the property's
`options` list) and `normalizeEnumValue()` in `helpers.ts` looks up the
canonical casing by case-insensitive match, falling back to the raw input
unchanged if nothing matches. The NDV warning can still appear (that part of
n8n core is unfixable from node code), but the actual request now uses the
correct casing either way. If another status-like field needs the same
treatment, reuse `normalizeEnumValue()` rather than re-deriving this.

## Known n8n editor bug (not cosmetic): `required` + expression-driven `displayOptions.show`

This one **does** block execution, unlike the warning above. Found in
`node-helpers.js#displayParameter()` (n8n-workflow): when checking whether a
field should be displayed, if *any* controlling parameter's value is a
string starting with `=` (i.e. it's an expression, value not known until
runtime), the function immediately returns `true` — the field is force-shown
— regardless of what the show/hide conditions actually say. If that field
also has `required: true`, n8n's parameter-issue check then requires it too,
producing a hard "Workflow execution cannot start" / "Parameter ... is
required" error even when the real (soon-to-be-resolved) value wouldn't
need that field at all.

Hit this on Sales Order → Update Status → **Ship Date**, which only makes
sense when Order Status is `ShipWhenSpecified`
(`displayOptions.show.statusOrderStatus: ['ShipWhenSpecified']`,
`required: true`). As soon as **Order Status** itself is set via an
expression, Ship Date got force-required, blocking every Update Status
execution regardless of the actual status value.

**Fix pattern**: don't set `required: true` on a field whose visibility
depends on another field that could plausibly be driven by an expression.
Keep the `displayOptions` (still useful for the common manual-selection
case) but drop `required`, and enforce the real requirement in `execute()`
once the actual resolved value is known — see the `ShipWhenSpecified` /
`statusShipDate` check right after the `normalizeEnumValue()` call in the
`updateStatus` block of `EclipseApi.node.ts`, which throws a
`NodeOperationError` if the (now-known) status needs a ship date but none
was given. Apply the same pattern to any other "field B is required only
when field A equals X" case if field A can be expression-driven — which,
for anything user-facing in this node, it always potentially can be.

## Recurring bug class: expressions resolve to native types, not strings

This node's `execute()` was originally written assuming every `string`/`json`
typed parameter always comes back as an actual JS string, and calls
`.trim()` / `JSON.parse()` on it directly. That's only true when the field
is set manually in the UI. When it's set via an expression (very common —
most real workflows map fields from upstream JSON), n8n returns whatever
native type the expression evaluates to: a `string` field fed
`{{ $json.billToId }}` returns a **number** if the upstream field is
numeric; a `json` field fed `{{ $json.lines }}` returns the actual
**array/object**, not a re-stringified JSON string. Calling `.trim()` on a
number, or `JSON.parse()` on an array, throws at runtime.

Two helpers in `helpers.ts` paper over this:
- `toTrimmedString(value)` — `String(value ?? '').trim()`. Use for any
  `string`-typed parameter that gets passed to the API as a plain string
  (IDs, branch codes, etc.).
- `parseJsonParameter<T>(value)` — passes non-string values through as-is,
  only calls `JSON.parse()` if the value is actually a string. Use for
  `json`-typed parameters.

Currently applied to: `billToCustomerId`, `shipToCustomerId`,
`salesOrderPriceBranch`, `salesOrderShipBranch`, `salesOrderPostalCode`, and
`salesOrderLines` (all in the Create Sales Order block). **Not yet applied**
to every other `(this.getNodeParameter(...) as string).trim()` call in the
file — there are many (Contact/Customer/Product get/create/update, the
other Sales Order update operations, `salesOrderCustomJson`, `updateFields`
in Update Customer, etc.). Each was fixed reactively when a user hit it, not
proactively across the board. If you're touching one of these blocks and
have a moment, consider applying the same helper rather than waiting for
the next report — but don't do a sweeping find-replace across the whole
file unprompted, since some of these may be intentionally guarded elsewhere
or behave differently (e.g. fields inside `collection`/`fixedCollection`
objects come back already-typed per their own declared type, not
necessarily as the parent's type).

## Gaps / things to know if asked to touch them

- `CHANGELOG.md` in this package's root is currently **empty**, even though
  `AGENTS.md` says to update it on version bumps. `.release-it.json` has no
  changelog-generation plugin configured, so nothing fills it automatically.
  If you bump the version, you likely need to actually write the entry by
  hand (or flag this gap to the user rather than silently skipping it).
- `package.json` version drifts frequently (bumped outside of chat sessions
  sometimes). Don't hardcode "the current version" anywhere assuming it's
  stable — read `package.json` fresh each time.

## Commands

- `npm run dev` (`n8n-node dev`) — runs n8n locally at `localhost:5678` with
  this node hot-loaded, for manual testing.
- `npm run build` (`n8n-node build`), `npm run lint` / `lint:fix`
  (`n8n-node lint`).
- `npm run release` (`release-it`) — builds, lints, tags, publishes to
  GitHub Package Registry (not public npm — see README's "Installation"
  section for the Docker-based install flow this requires downstream).
