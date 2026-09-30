# HANDOFF: @profitpad-inc/n8n-nodes-erpnext

Current-state map of this package. Read before changing anything; update when a change makes it
stale.

## Files

| Path | What it is |
|---|---|
| `nodes/ErpNext/ErpNextTokenApi.credentials.ts` | Credential `erpNextTokenApi`: Credential Notes, Base URL, API Key, API Secret. Header `Authorization: token <key>:<secret>`. Test: `GET /api/method/frappe.auth.get_logged_user` |
| `nodes/ErpNext/ErpNext.node.ts` | Action node `erpNext`: `execute()` for the Document and Method resources |
| `nodes/ErpNext/ErpNextTrigger.node.ts` | Polling trigger `erpNextTrigger`: `poll()` |
| `nodes/ErpNext/helpers.ts` | Request wrapper with retries, error unpacking, change detection, Frappe datetime maths, poll dedupe, load options |
| `nodes/ErpNext/descriptions/*` | Parameter definitions for each resource |
| `test/helpers.test.js` | `node:test` unit tests for the pure helpers; runs against `dist/` (`npm run build && npm test`) |
| `erpnext_n8n_node.md` | Parameter reference for writing workflow JSON |

## API used

Frappe REST v1 (works on ERPNext v14 to v16):

- `GET/POST /api/resource/{DocType}` for list and create. List takes `fields`, `filters`,
  `or_filters` (JSON strings), `order_by`, `limit_start`, `limit_page_length`.
  `limit_page_length=0` means all.
- `GET/PUT/DELETE /api/resource/{DocType}/{name}`. Names are URL-encoded; customer names often
  contain spaces and dots.
- `GET/POST /api/method/{dotted.path}` for whitelisted methods; the result is in `message`.
- Load options: DocTypes from `/api/resource/DocType` (`istable = 0`), fields from
  `/api/method/frappe.desk.form.load.getdoctype` (returns `docs[0].fields`). Both are cached per
  site for 2 minutes.

## Behaviour worth knowing

- **Output shapes:**
  - Get and Create return the document itself.
  - Get Many returns one item per row.
  - Delete returns `{deleted: true, doctype, name}`.
  - Update and Create or Update return
    `{action: created|updated|unchanged|notFound, changed, doctype, name, changes: [{field, from, to}], doc}`.
- **Create or Update:**
  - Matches on `matchField = matchValue` first, then `fallbackMatchField = fallbackMatchValue`.
  - A match on `name` is a direct GET. Any other field is a filtered list, and more than one hit
    fails as "ambiguous" instead of guessing.
  - On create, the match value is stamped onto the new document when the body doesn't already
    set that field, so the next run finds it by the same field.
- **ERPNext allows duplicate customer names.** Creating a second Customer named "X" quietly makes
  "X - 1" (Customer Name naming). This is why syncs should match on a stored ID with the exact
  name as fallback, never create blindly.
- **Skip If Unchanged** (`writeOptions.skipIfUnchanged`, default on):
  - It reads the stored document and diffs only the fields being sent, via `diffFields` in
    `helpers.ts`.
  - **Equal values:** empty, null and undefined are equal. Booleans equal Check fields (0/1).
    Strings are trimmed but keep their case. A number equals its numeric string, but only when
    one side really is a number, so "007" is never "7".
  - **Child tables** compare as unordered sets of rows, looking only at the columns the desired
    rows set. Row metadata (name, idx, parent...) is ignored.
  - Sending a child table in a write replaces the whole table (Frappe semantics).
- **Trigger:**
  - **First activation** records the newest existing `modified` (or `creation` for New) matching
    the filters as its watermark and emits nothing. Turning a workflow on never replays history.
  - **Each poll** re-reads from `watermark - lookbackSeconds` (default 60), oldest first, capped at
    Max Documents Per Poll.
  - **Dedupe:** already-emitted `name|modified` pairs are stored in workflow static data and
    skipped; entries older than the window are pruned.
  - **Updated** additionally requires `creation < windowStart`.
  - **Timestamps:** Frappe returns naive site-local datetimes, with no fraction when the
    microseconds are 0. The code never converts time zones. It only parses to microseconds,
    compares and subtracts (`parseFrappeDatetime`, `windowStartFrom`, `latestDatetime`).
  - **Ignore Changes By Users** matches `modified_by` after dedupe. Syncs using Skip If Unchanged
    don't need it; filtering the sync user can drop a human edit that lands between two sync
    writes.
  - **Manual mode** ("Fetch Test Event", or running the workflow by hand) skips the window and
    returns the latest matching documents up to the cap. That doubles as a backfill.
  - **Include Child Tables** re-reads each document with GET, one request per document.
- **Errors:**
  - Frappe's reason is in `_server_messages` (a JSON string of JSON strings) or in `exception`.
    `describeErpNextError` extracts it, strips HTML, and it becomes the NodeApiError message.
  - Validation and input problems throw NodeOperationError with the item index.
  - `erpNextRequest` retries 429/502/503/504 four times (1, 2, 4, 8 s plus jitter) and re-throws
    everything else unchanged.

## Deployment on the ProfitPad VM

- Installed in n8n's custom extensions folder, `/home/node/custom-nodes/node_modules/@profitpad-inc/n8n-nodes-erpnext`,
  next to the HubSpot, Eclipse and robust-scheduler packages.
- n8n loads that folder with its custom-directory loader, so **node types there are
  `CUSTOM.erpNext` and `CUSTOM.erpNextTrigger`**, not `@profitpad-inc/n8n-nodes-erpnext.*`.
  Workflow JSON for that VM must use the `CUSTOM.*` names (the same goes for `CUSTOM.hubspotApi`).
- n8n must restart to load a new version.
- Published to GitHub Packages (`npm publish` for 0.1.0, tag `n8n-nodes-erpnext@0.1.0`). Future
  versions go out with `npm run release`. The VM's `~/docker/Dockerfile` custom-nodes `npm install`
  line includes it.
- The first user is the ERPNext ↔ HubSpot customer and contact sync; see
  `profitpad_work/ERP.Next/HANDOFF.md`.

## Known limits / ideas

- No webhook trigger yet. Frappe's Webhook doctype (with an HMAC secret) could back a push
  trigger later, but polling matches the repo's other triggers and can't miss events.
- Get Many doesn't return child tables. Use Get per document, or the trigger's Include Child
  Tables.
