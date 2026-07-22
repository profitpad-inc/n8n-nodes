# Changelog

## Unreleased

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
