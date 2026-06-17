# HubSpot n8n Node — Handoff

## What this is

A custom n8n community node (`@profitpad-inc/n8n-nodes-hubspot`) for the HubSpot CRM API.
It was built by converting an existing Eclipse ERP node template into a HubSpot integration.

**Package path:** `packages/n8n-nodes-hubspot`
**Node name in n8n:** `HubSpot-P` (display name), `hubspotApi` (internal name)

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
- Contact path: `/crm/v3/objects/contacts` (NOT `/crm/v3/contacts` — that returns 404 for this account)
- Auth: `httpRequestWithAuthentication('hubspotApi', ...)` — credentials inject the Bearer header
- Content-Type and Accept headers set on every request via `BASE_HEADERS`

#### Contact resource — 4 operations (all working)

| Operation | Method | URL |
|-----------|--------|-----|
| Get | GET | `/crm/v3/objects/contacts/{contactId}` |
| Get Many | GET | `/crm/v3/objects/contacts?limit=N` |
| Create | POST | `/crm/v3/objects/contacts` |
| Update | PATCH | `/crm/v3/objects/contacts/{contactId}` |

**Get Many** supports:
- `returnAll` toggle (cursor-paginates via `paging.next.after`)
- `limit` (1–100, default 50)
- Optional: `properties` (comma-separated), `after` cursor, `archived` flag

**Get** supports optional: `properties`, `associations`, `archived`

**Create / Update**: use a `fixedCollection` of `name`/`value` property pairs.
HubSpot property names: `email`, `firstname`, `lastname`, `phone`, `company`, `website`, `jobtitle`, etc.

### Helpers — `nodes/HubSpot/helpers.ts`
`buildHubSpotUrl(base, path, params)` — builds URLs with proper repeated params for arrays
(e.g. `?properties=email&properties=firstname` instead of `?properties[0]=email`)

### Other description files (empty stubs, ready for future use)
- `CustomerDescription.ts` → exports `companyDescription = []`
- `ProductDescription.ts` → exports `productDescription = []`
- `SalesOrderDescription.ts` → exports `dealDescription = []`

### Trigger node — `nodes/HubSpot/HubspotApiTrigger.node.ts`
Stub only — `poll()` returns `null`. Needs to be implemented for HubSpot webhook/polling use cases.

---

## Key technical notes

- **URL pattern**: HubSpot's named path `/crm/v3/contacts` returned 404 for this account. The generic objects path `/crm/v3/objects/contacts` (equivalent to object type `0-1`) works correctly.
- **Auth expression**: `={{"Bearer " + $credentials.accessToken}}` is the correct n8n expression syntax for `IAuthenticateGeneric`. The `{{...}}` template format (without `=`) is NOT evaluated and sends a literal string.
- **Array query params**: HubSpot expects repeated params (`?properties=a&properties=b`), not indexed (`?properties[0]=a`). The `buildHubSpotUrl` helper handles this via `URLSearchParams.append`.
- **Linter rule**: `@n8n/community-nodes/no-http-request-with-manual-auth` — if you call `this.getCredentials()`, you must use `httpRequestWithAuthentication`, not `httpRequest`.

---

## What's next (suggested)

1. **Company resource** — `CustomerDescription.ts` is stubbed as `companyDescription`. Implement CRUD for `/crm/v3/objects/companies`.
2. **Deal resource** — `SalesOrderDescription.ts` is stubbed as `dealDescription`. Implement CRUD for `/crm/v3/objects/deals`.
3. **Product resource** — `ProductDescription.ts` is stubbed as `productDescription`. HubSpot products live at `/crm/v3/objects/products`.
4. **Trigger node** — Implement polling on `/crm/v3/objects/contacts` filtered by `lastmodifieddate` property.
5. **Associations** — HubSpot associations API at `/crm/v3/associations/{fromObjectType}/{toObjectType}/batch/read`.

---

## Dev commands

```bash
npm run build    # compile TypeScript → dist/
npm run lint     # run n8n linter (strict mode)
npm run dev      # start n8n dev server with hot reload at http://localhost:5678
```

Build output goes to `dist/nodes/Hubspot/` (lowercase s — matches `package.json` `n8n.nodes` paths).
