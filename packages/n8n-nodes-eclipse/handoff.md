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

**Return All Mode** (`returnAllMode`, added 2026-09-11, one per resource —
same param name reused across Contact/Customer/Product/Sales Order
description files, gated by `displayOptions.show.returnAll: [true]`, same
convention as `returnAll`/`pageSize` already being duplicated per-resource
rather than shared via a helper): added to every plain Get Many `returnAll`
loop (Contact, Customer, Product, Sales Order), mirroring the
`pricingReturnAllMode` field added earlier to Product Inventory Pricing
Inquiry and the pre-existing `returnAllMode` pattern in
`n8n-nodes-hubspot`/`n8n-nodes-microsoft-outlook`. Same three options,
same semantics: `eachPage` (default, unchanged), `allInOne` (all filtered
results combined into one item, `metadata` as an array of every page's
`response.metadata`), `eachResult` (one item per filtered record, no
metadata). Assumes these list endpoints' response envelope is
`{ metadata: {...}, results: [...] }`, following the shape confirmed for
the pricing mass-inquiry endpoints — not independently re-confirmed for
Contacts/Customers/Products/SalesOrders specifically, so if `allInOne`'s
metadata array comes back full of `null`s for one of these resources, that
assumption is the first thing to check.

**Deliberately out of scope**: the two dedicated ID-batching paths (Product
Get Many >200 IDs, Sales Order Get Many >100 IDs — see below) do not read
`returnAllMode` at all. They already unconditionally combine/re-chunk
results themselves regardless of Return All, and already intentionally
drop the per-page envelope (see the Sales Order batching note below), so
layering Return All Mode on top of them wasn't requested and would need
its own design (e.g. what "each page" even means once results are
recombined and re-chunked by Page Size). If asked to extend Return All
Mode to those paths later, treat it as a separate task, not an oversight.

## Sales Order Get Many: ID batching

Eclipse errors when a single `GET /SalesOrders` request carries too many `id`
query params, so Sales Order → Get Many has a third code path (alongside the
normal Return All / single-page paths) that kicks in when the **ID** option in
Additional Options resolves to **more than 100** comma-separated IDs:

- The ID list is chunked into batches of 100 and fired as one request per
  batch. Each batch request asks for `batchIds.length + 1` rows so a short
  page (the normal case, since an ID filter matches at most one order per ID)
  ends that batch in a single request, while a *full* page signals the filter
  matched more rows than IDs sent (e.g. an ID given without its generation)
  and the batch keeps paging via `startIndex`.
- All batch results are collected, then re-chunked for output by the user's
  **Page Size**: 300 IDs with Page Size 200 = 3 requests to Eclipse but 2
  output items (200 results, then 100). Unlike the non-batched paths, the
  output items **drop Eclipse's response metadata entirely** — each item is
  just `{ countItems, results }`, where `countItems` is the length of that
  item's own `results` array (not the combined total), since the envelope from
  any one batch response would be misleading once results are recombined.
- This path ignores `Return All` and `Start Index` — the ID list is itself the
  bound on how much data can come back, so everything matching is fetched.

`buildUrl` in that block takes `(startIndex, ids, requestPageSize)` so all
three paths share one query-string builder. Only the sales order `id` filter
is batched; the other multi-value filters (BillTo, ShipTo, etc.) and the other
resources' `getMany` operations are untouched — apply the same pattern there
if a user hits the same limit.

## Trigger node (`EclipseApiTrigger.node.ts`)

Polls on a schedule. Two lookback modes:
- **Rolling window** (default): looks back `pollInterval` minutes from now
  only on the very first run (no `lastRunTime` in workflow static data yet,
  `getWorkflowStaticData('node')`). Every run after that trusts `lastRunTime`
  exactly, so consecutive polls neither gap nor overlap. Manual executions
  always use `now - pollInterval` (ignore `lastRunTime`) since there's no
  meaningful "last run" for a manual trigger.
- **Custom date mode** (`useCustomDate: true`): uses a fixed
  `updatedAfter` dateTime param directly, no static-data bookkeeping.

Returns `null` (not an empty array) when there are zero results, which is
the n8n convention for "nothing happened this poll."

**Bug fixed (2026-08-17), then deliberately reverted (2026-09-11)**: the
rolling-window branch used to pick whichever of `lastRunTime` or
`now - pollInterval` was *earlier*, on every run, not just the first. Intent
(per the original comment) was to widen the window after downtime, but the
effect in the normal steady-state case (trigger polling continuously,
`lastRunTime` more recent than `now - pollInterval`) was the opposite of
what's wanted: `lastRunTime` lost that comparison every time, so
`now - pollInterval` won and every poll re-fetched the full
`pollInterval`-minutes window from scratch. Any record modified inside that
window got re-emitted on *every* poll until it aged out — e.g. with the
default 5-minute Lookback Window and a 1-minute poll schedule, the same
record could be redelivered 5 times in a row. Symptom reported by a user:
the same sales order showing up repeatedly with what looked like different
snapshots of its data over the course of a day. 2026-08-17 fix:
`lookbackTime = lastRun ?? intervalLookback` — trust `lastRunTime`
unconditionally once it exists; `intervalLookback` was only reachable on the
first-ever run.

That fix was then **explicitly reverted back to the earlier-of-the-two
comparison on 2026-09-11**, at a user's request, for a specific workflow:
`rawLookback = lastRun && lastRun < intervalLookback ? lastRun : intervalLookback`,
applied every run again, not just the first. The user confirmed their
downstream flow is fully idempotent, so the re-emission side effect above is
acceptable to them — they wanted the Lookback Window to act as a hard
"always look back at least N minutes" guarantee on every poll, not just a
gap-filler for the first run. **If a future session is asked to "fix"
duplicate/re-emitted records on this trigger again, don't reflexively
reapply the 2026-08-17 fix** — check whether the workflow depends on this
reverted behavior first, since removing it silently would violate what was
explicitly requested here.

## Poll Buffer (Minutes) (`pollBufferMinutes`, added 2026-09-11)

Added alongside the revert above, to fix a related but distinct problem:
Sales Order polling has an optional `LastModifiedDateAndTimeStampEnd` filter
(Date Filter Options → Last Modified Date End) that a user had set manually
to a fixed `$now.minus(10, 'minutes')` expression, to work around a "weird
Eclipse bug" (their words — not independently diagnosed) where very
recently modified orders come back inconsistently. That field only shifts
the *end* of the window; the *start* (`LastModifiedDateAndTimeStampStart`,
i.e. `lookbackTime`) is computed independently from `lastRunTime`/lookback
and keeps advancing toward "now" every poll. Once the actual poll schedule
ran more frequently than the fixed 10-minute End offset, `lastRunTime`
(Start) became more recent than `now - 10min` (End), and Eclipse rejected
the request with `"LastModifiedDateAndTimeStampStart can not be greater
than LastModifiedDateAndTimeStampEnd"` (400) — reliably, on every poll,
until the user manually intervened.

Root cause: shifting only one side of the window while the other side keeps
tracking real time will always eventually invert once the poll cadence is
faster than the shift amount. Fix: `pollBufferMinutes` (default `0`, so
existing workflows are unaffected) is now applied symmetrically to *both*
`lookbackTime` and a new `windowEndTime`, computed from the same
`rawLookback`/`currentRunTime` before the buffer subtraction — see the
`poll()` block right after the lookback-timestamp comments in
`EclipseApiTrigger.node.ts`. For Sales Order, `windowEndTime` is
auto-set as `LastModifiedDateAndTimeStampEnd` only when the buffer is > 0
**and** the user hasn't manually filled in Date Filter Options' own End
field (a manual value always wins, so existing per-workflow overrides don't
silently change). Other resources (Contact/Customer/Product) only ever send
`updatedAfter` (no End param exists for them in the API), so the buffer
just shifts that value back; there's nothing to auto-populate there.

If asked to debug this again on a workflow that still has a manual
`$now.minus(...)` expression in Date Filter Options' Last Modified Date End
field, the fix is to clear that field and use `pollBufferMinutes` instead —
leaving both configured at once works (manual wins) but is redundant and
confusing, since only one of them is actually doing anything.

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
`salesOrderPriceBranch`, `salesOrderShipBranch`, `salesOrderPostalCode`,
`salesOrderLines`, `updatePriceCustomJson`, `updateQtyCustomJson`, and (as of
this fix) every `*CustomJson` field: `customJson` (Customer Create, Contact
Create), `updateCustomJson` (Customer Update, Contact Update), and
`salesOrderCustomJson` (Create Sales Order). Each of those previously did
`(this.getNodeParameter(...) as string).trim()` then `JSON.parse()`, which
threw whenever a user fed the field a whole-expression object reference
(e.g. `={{ $json.eNewCustomer }}`) instead of a manually-typed JSON string —
the workaround users found was calling `.toJsonString()` in the expression,
which forces a real string before n8n's coercion kicks in. That workaround
is no longer necessary for these fields.

**Not yet applied** to every other `(this.getNodeParameter(...) as
string).trim()` call in the file — there are many (Contact/Customer/Product
get/create/update, the other Sales Order update operations, `updateFields`
in Update Customer, etc.). Each was fixed reactively when a user hit it, not
proactively across the board. If you're touching one of these blocks and
have a moment, consider applying the same helper rather than waiting for
the next report — but don't do a sweeping find-replace across the whole
file unprompted, since some of these may be intentionally guarded elsewhere
or behave differently (e.g. fields inside `collection`/`fixedCollection`
objects come back already-typed per their own declared type, not
necessarily as the parent's type).

## Gaps / things to know if asked to touch them

- `CHANGELOG.md` in this package's root is very sparse (only has a handful
  of entries despite many more version bumps in `package.json`/git log),
  even though `AGENTS.md` says to update it on version bumps.
  `.release-it.json` has no changelog-generation plugin configured, so
  nothing fills it automatically. If you bump the version, you likely need
  to actually write the entry by hand (or flag this gap to the user rather
  than silently skipping it).
- `package.json` version drifts frequently (bumped outside of chat sessions
  sometimes). Don't hardcode "the current version" anywhere assuming it's
  stable — read `package.json` fresh each time.

## Product Inventory Pricing Inquiry: mass inquiry endpoints

`getProductInventoryPricingInquiry` (Product resource) originally called
`ProductInventoryPricingInquiry` and `ProductPricingInquiry` with a single
`ProductId`, returning one flat object per call (no `results` wrapper). It
was changed to call the mass-inquiry variants instead —
`ProductInventoryPricingMassInquiry` and `ProductPricingMassInquiry` — so a
single execution can price/inventory multiple products at once. The "Product
IDs" field (`pricingProductId`) now accepts a comma-separated list and is sent
as repeated `ProductId` query params (`?ProductId=1&ProductId=2&...`, same
`ProductId` casing as the pre-existing single-ID call). A new "Page Size"
field (`pricingPageSize`, default and max 100 — see below) was added, and
the operation always paginates (loops bumping `StartIndex` by `PageSize`),
stopping when either: a page comes back shorter than `PageSize`, or
`currentStart + pageSize` would exceed the response's `metadata.totalItems`
(only checked when `totalItems` is an actual number — it can be `null` if
`IncludeTotalItems` wasn't honored, in which case only the page-length
check applies). There's no "Return All" toggle here, since the caller is
expected to pass exactly the product IDs they want.

**Live testing against Eclipse (2026-09-10)** surfaced two separate
findings — don't conflate them, they were reported together but are
unrelated:
- The mass endpoints appear to cap results at 100 per page regardless of a
  higher requested `PageSize`. `pricingPageSize` has
  `typeOptions: { minValue: 1, maxValue: 100 }`, default 100, and
  `execute()` also clamps via `Math.min(pageSize, MAX_PAGE_SIZE)` as a
  belt-and-suspenders guard (the NDV's `maxValue` doesn't stop an
  expression-driven value from exceeding it — see the "options field value
  warnings" / expression-driven `displayOptions` entries above for the
  general pattern of NDV constraints not being enforced at execution time).
  **Note**: this clamp was added, then briefly removed at the user's
  request to allow free experimentation ("don't clamp down the max, i want
  to be able to put it to whatever i want for now"), then put back again
  shortly after. If asked to remove it again, confirm with the user first
  rather than assuming the earlier removal request still stands — it's
  flip-flopped once already in the same session.
- Separately, sending more than ~119 `ProductId` query params in one
  request causes a **404** — confirmed independent of page size (it
  happened even with `pageSize: 10`), so it's a query-string-length limit
  on Eclipse's side, not a page-size-related limit (IIS's default max query
  string is 2048 bytes, and ~119 numeric IDs as `&ProductId=NNNNNN` lands
  right around that). `execute()` batches `productIds` into chunks of
  `PRODUCT_ID_BATCH_SIZE` (100, comfortably under the ~119 threshold) and
  runs the full per-batch pagination loop for each chunk, pushing one
  output item per page per batch — same overall shape as the existing
  Sales Order Get Many ID-batching path, but simpler since there's no
  "request batchSize+1 to detect an extra page" trick needed here (both
  `pageSize` and the ID batch size independently cap at 100, so a batch's
  own IDs can never exceed one page).

This was implemented without access to Eclipse's API docs for the mass
endpoints, based on this endpoint's own existing PascalCase query param
convention (`CustomerId`, `ProductId`, `ConsiderUserAuthBranch`, `ShowCost`,
`Quantity`) and this package's general list-response shape. **Confirmed
against a live execution** (2026-09-10, 5 product IDs, default page size):
the `PageSize`/`StartIndex`/`ProductId` PascalCase query params work as
expected, and the response shape is `{ metadata: { startIndex, pageSize,
totalItems }, results: [...] }` — note the envelope key is `metadata`
(singular object), not a flat spread of `startIndex`/`pageSize`/`totalItems`
at the top level, and the response's own field names inside `metadata` are
lowercase camelCase even though the request query params are PascalCase.
Each entry in `results` carries a `productId` field.

The per-product merge logic (`quantityBreaks` fix-up: the single-quantity
response doesn't return `quantityBreaks` and the max-quantity response has
the wrong first-break price) merges the three mass responses' `results`
arrays by array index rather than matching on the `productId` field each
result carries. This worked fine in the one live test done so far (5 IDs,
single page), but if the three mass endpoints ever return results in
different orders relative to each other (e.g. one sorts, one doesn't) or
omit an entry for some product, an index-based merge would silently
misalign data across products. Matching by `productId` instead would be a
quick, low-risk hardening if that's ever observed — the field is confirmed
present on every result.

**Different Eclipse accounts return different field names** (2026-09-11):
tested with a second customer's credential (`eclipse`, distinct from the
first session's `fairbank`) and the per-product fields came back as
`productCOGS`/`listPrice`/`unitPrice`/`totalWarehouseQty`/`stockInfo`/
`customerPN`/`productDescription`, not the `productCost`/`productUnitPrice`
names confirmed earlier. The merge logic's field-name assumptions
(`singlePricing.productUnitPrice`, in particular) were written against the
first account's shape — if a future session sees the quantityBreaks
fix-up silently no-op or throw on a different customer's data, check
whether that account's response uses different field names before
assuming it's a logic bug. (Separately, on 2026-09-11 an apparent "stopped
returning quantityBreaks" report turned out to be the product itself
having no volume pricing configured in Eclipse — not a code issue. Confirm
the product actually has tiered pricing before assuming a regression.)

**Return All Mode** (`pricingReturnAllMode`, added 2026-09-11): mirrors the
`returnAllMode` pattern already used in sibling packages
(`n8n-nodes-hubspot`, `n8n-nodes-microsoft-outlook` — see e.g.
`ObjectDescription.ts` in the HubSpot package). Three options — `eachPage`
(default, unchanged behavior: one output item per page/batch with that
page's `metadata`), `allInOne` (every result across every page and batch
combined into one output item; `metadata` here is an **array** of every
page's metadata, not just the last page — deliberately different from the
HubSpot/Outlook precedent, which uses the last page's metadata only,
because the user explicitly asked for all pages' metadata to be kept),
`eachResult` (one output item per individual product result, no metadata
at all). Implemented by branching inside the existing batch/pagination
loop rather than adding a separate code path, so it
doesn't duplicate the request logic per mode.

## Commands

- `npm run dev` (`n8n-node dev`) — runs n8n locally at `localhost:5678` with
  this node hot-loaded, for manual testing.
- `npm run build` (`n8n-node build`), `npm run lint` / `lint:fix`
  (`n8n-node lint`).
- `npm run release` (`release-it`) — builds, lints, tags, publishes to
  GitHub Package Registry (not public npm — see README's "Installation"
  section for the Docker-based install flow this requires downstream).
