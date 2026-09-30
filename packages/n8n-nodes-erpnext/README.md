# @profitpad-inc/n8n-nodes-erpnext

n8n community nodes for [ERPNext](https://erpnext.com) (any Frappe site), built for two-way
syncs: every write can skip itself when nothing changed, and the trigger polls without missing
or repeating changes.

## Nodes

| Node | Type in workflow JSON | What it does |
|---|---|---|
| ERPNext | `@profitpad-inc/n8n-nodes-erpnext.erpNext` | Get, Get Many, Create, Update, Create or Update (upsert), Delete for any DocType, plus calling whitelisted methods |
| ERPNext Trigger | `@profitpad-inc/n8n-nodes-erpnext.erpNextTrigger` | Polls a DocType for new or saved documents |

## Credential

**ERPNext Token API** (`erpNextTokenApi`): the site's Base URL plus an API key and secret.
Generate them in ERPNext under the user the integration should act as
(User → Settings → API Access → Generate Keys). Requests are sent as
`Authorization: token <key>:<secret>`.

The type is named `erpNextTokenApi` so it never collides with the `erpNextApi` credential of
n8n's built-in ERPNext node.

## Why not n8n's built-in ERPNext node

The built-in node only does basic document CRUD. This package adds what a sync needs:

- **Create or Update** matched on any field (for example a stored external ID), with a fallback
  field, so re-running a sync never creates duplicates.
- **Skip If Unchanged** on Update and Create or Update: the node compares the fields you send
  with what ERPNext stores and writes nothing when they already match. An echo from the other
  system then ends the round trip instead of looping.
- **ERPNext Trigger**, which the built-in node doesn't have.
- **Readable errors**: ERPNext's `_server_messages` are unpacked into the n8n error message.
- **Retries** on 429 and on 502/503/504 while the site restarts.

See [`HANDOFF.md`](HANDOFF.md) for behaviour details and [`erpnext_n8n_node.md`](erpnext_n8n_node.md)
for the parameter reference used when writing workflow JSON.

## Development

```bash
npm run build   # compile to dist/
npm run lint
npm test        # unit tests for the pure helpers (run after build)
npm run release # build, test, version, tag, push and publish to GitHub Packages
```
