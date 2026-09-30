# @profitpad-inc/n8n-nodes-erpnext: node reference (v0.1.0)

Parameter names for generating workflow JSON. Both nodes are `typeVersion: 1`.

**Node type strings** depend on how the package is installed. Installed as a community package, they're
`@profitpad-inc/n8n-nodes-erpnext.erpNext` and `.erpNextTrigger`. Installed in a custom extensions folder,
as on the ProfitPad VM (`/home/node/custom-nodes`), they're `CUSTOM.erpNext` and `CUSTOM.erpNextTrigger`.

## Credential

```json
"credentials": { "erpNextTokenApi": { "id": "<credential-id>", "name": "<credential-name>" } }
```

Fields: `notes`, `baseUrl`, `apiKey` (password), `apiSecret` (password).

## Action node `erpNext`

Top level: `resource` = `document` (default) | `method`.

### resource = document

| Parameter | Used by | Notes |
|---|---|---|
| `operation` | all | `get` (default), `getMany`, `create`, `update`, `upsert` (shown as "Create or Update"), `delete` |
| `docType` | all | DocType name, e.g. `Customer` |
| `documentName` | get, update, delete | The document's `name` |
| `matchField` | upsert | Fieldname to match on (default `name`) |
| `matchValue` | upsert | Value to match; empty skips straight to the fallback |
| `inputMode` | create, update, upsert | `ui` (default) or `json` |
| `fieldsUi.fieldValues[]` | create, update, upsert (ui) | `{ "name": "<fieldname>", "value": "<value>" }` |
| `fieldsJson` | create, update, upsert (json) | JSON object; child tables as arrays of row objects |
| `returnAll`, `limit` | getMany | `limit` default 50 |
| `filters` | getMany | Frappe filters JSON, e.g. `[["customer_type","=","Company"]]` |
| `returnFields` | getMany | Comma-separated fieldnames, or `*` |
| `getOptions.errorWhenNotFound` | get | Default true; false returns `{found:false, doctype, name}` |
| `getManyOptions.orFilters`, `getManyOptions.orderBy` | getMany | orderBy default `modified desc` |
| `writeOptions.skipIfUnchanged` | update, upsert | Default true |
| `writeOptions.createIfNotFound` | upsert | Default true; false returns action `notFound` |
| `writeOptions.fallbackMatchField`, `writeOptions.fallbackMatchValue` | upsert | Second match attempt |

Update and upsert output:
`{action, changed, doctype, name, changes: [{field, from, to}], doc}`.

### resource = method

| Parameter | Notes |
|---|---|
| `operation` | `call` |
| `methodPath` | e.g. `frappe.client.get_count` |
| `httpMethod` | `GET` (default) or `POST` |
| `methodParameters` | JSON object; query string for GET, JSON body for POST |

Output: ERPNext's response as-is (the result is under `message`).

## Trigger node `erpNextTrigger`

| Parameter | Notes |
|---|---|
| `triggerOn` | `newOrUpdated` (default), `new`, `updated` |
| `docType` | e.g. `Customer` |
| `filters` | Frappe filters JSON, default `[]` |
| `includeChildTables` | Default false; true re-reads each doc so child tables are included |
| `options.ignoreUsers` | Comma-separated `modified_by` values to drop |
| `options.lookbackSeconds` | Default 60 |
| `options.maxDocuments` | Default 500 per poll |

The poll interval is the standard n8n `pollTimes` node setting, for example:

```json
"parameters": { "pollTimes": { "item": [{ "mode": "everyMinute" }] }, "triggerOn": "newOrUpdated", "docType": "Customer" }
```

Output: one item per document, with every top-level field (and child tables when requested).
