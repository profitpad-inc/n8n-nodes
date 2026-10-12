# Ninety n8n Node: Handoff

## What this is

A custom n8n community node (`@profitpad-inc/n8n-nodes-ninety`) for the Ninety public API.
Its structure, credential style, request wrapper and error handling are modelled on
`packages/n8n-nodes-hubspot`.

**Package path:** `packages/n8n-nodes-ninety`
**Node in n8n:** `Ninety` (internal name `ninety`), action node only, no trigger
**API docs:** https://api.public.ninety.io/v1/swagger (raw spec: https://api.public.ninety.io/v1/swagger-json)

Version `0.1.0`, not yet published. Scope so far is the three Scorecard calls the user was making
with HTTP Request nodes (read a Team Scorecard, write a score, clear a score).

---

## File map

| File | What lives there |
|---|---|
| `nodes/Ninety/Ninety.node.ts` | The action node: resource/operation routing, `execute()`, Scorecard output splitting |
| `nodes/Ninety/NinetyApi.credentials.ts` | Personal Access Token credential (`ninetyApi`) |
| `nodes/Ninety/helpers.ts` | Base URL, `ninetyRequest` (429 retry), `ninetyUrl`, `normalizePeriodStartDate`, response types, `getTeams` / `getKpis` load options |
| `nodes/Ninety/descriptions/ScorecardDescription.ts` | Scorecard resource UI |
| `nodes/Ninety/ninety.svg` | Node and credential icon: the Ninety app icon from Google Play (WebP converted to a 240x240 PNG), embedded in an SVG wrapper because the n8n linter only accepts SVG icons |
| `ninety_n8n_node.md` | Parameter reference for generating workflow JSON |

Constants in `helpers.ts`:

| Constant | Value |
|---|---|
| `NINETY_BASE` | `https://api.public.ninety.io` |
| `API_BASE_PATH` | `/v1` |

`SCORECARD_BASE_PATH` (`/scorecard`) is in `Ninety.node.ts`.

---

## Credentials: `NinetyApi.credentials.ts`

- Fields: **Credential Notes** (not sent), **Personal Access Token** (password, required).
- Generic auth: `Authorization: Bearer <accessToken>`. This is the same header the user's
  `httpBearerAuth` credential sent in the HTTP Request nodes this package replaces.
- Test request: `GET https://api.public.ninety.io/v1/teams`.

---

## Resource: Scorecard

| Operation (value) | Request | Output |
|---|---|---|
| Get Team Scorecard (`getTeamScorecard`) | `GET /v1/scorecard/team-scorecard?teamId=&periodInterval=[&window=][&date=]` | Depends on **Output** (below) |
| Create or Update Score (`upsertScore`) | `POST /v1/scorecard/kpis/{kpiId}/scores` body `{value, periodStartDate}` | Ninety's response as-is (`{id, value, periodStartDate}` per the spec) |
| Clear Score (`deleteScore`; shown as Clear Score, internal value kept as `deleteScore`) | `DELETE /v1/scorecard/kpis/{kpiId}/scores/{periodStartDate}` | `{deleted: true, kpiId, periodStartDate}` (the API returns 204 with no body) |

### Get Team Scorecard details

- **Team** (`teamId`): dropdown from `getTeams` (`GET /v1/teams/available`). That endpoint
  returns every Team the user can work on; for Owners/Admins/Implementers that includes Teams
  they aren't a member of. Names are shown as-is (trimmed, with any "(not a member)" suffix
  stripped by regex); membership is not indicated. `GET /v1/teams` only returns the
  caller's own Teams, so it is used only for the credential test.
- **Period Interval**: `weekly` (default, same as the API default), `monthly`, `quarterly`, `annual`.
- **Additional Options**:
  - **Window**: `default`, `qtd`, `ytd`, `currentQuarter`, `currentYear`. Per the spec,
    quarterly supports only `default`, `ytd`, `currentYear`; annual supports only `default`. The
    node does not pre-validate this; Ninety's error comes back as a NodeApiError.
  - **Date**: a calendar date; returns only the period containing it. The API says `date` and
    `window` are mutually exclusive, so when Date is set the node does not send `window`.
- **Output** (`outputMode`):
  - `scorecard` (default): the response as one item.
  - `kpis`: one item per Measurable: `scorecardId, scorecardName, periodInterval, teamId,
    groupId, groupName, kpiId, kpiTitle`, the rest of the Measurable's fields, and `scores`.
  - `scores`: one item per Measurable per period: the same identifiers plus `unit, currency,
    ownerName, defaultGoal` and the score's own fields (`label, periodStartDate, isFuture,
    partialInterval, value, goal, note`).

### Create or Update Score / Clear Score details

- **Team** (`teamId`, optional) and **Period Interval** (`periodInterval`, default `weekly`)
  come first and only filter the Measurable dropdown: `getKpis` reads them with
  `getCurrentNodeParameter` and sends them as `teamId` / `periodInterval` in the query body.
  They are not sent with the score request. They are separate field definitions from the Get
  Team Scorecard ones (Team is not required here; empty means every Team) but share the same
  parameter names, so the selection carries over when switching operations.
- **Measurable** (`kpiId`): dropdown from `getKpis` (`POST /v1/scorecard/kpis/query`, sorted by
  title, 100 per page, `loadOptionsDependsOn: ['teamId', 'periodInterval']`). Labels are `Title (Team names, interval[, archived])`, with the owner as
  the option description.
- **Period Start Date**: n8n `dateTime` picker. `normalizePeriodStartDate` always sends
  `YYYY-MM-DDT00:00:00.000Z` (the format in the swagger examples and the user's working
  requests):
  - A value with no timezone (`YYYY-MM-DD`, or the picker's `YYYY-MM-DDTHH:mm:ss`) is a
    calendar date: its date part becomes midnight UTC and the time of day is dropped.
  - A value with `Z` or an offset (from an expression, or a luxon DateTime) is converted to UTC,
    so `2026-07-31T20:00:00-04:00` becomes `2026-08-01T00:00:00.000Z`.
  - Unparseable text is passed through for Ninety to reject.
  - Whether the POST snaps a mid-period date to the period start is not documented (the PATCH
    endpoint's docs say it does), so the field asks for the first day of the period.
- **Value** (upsert only): number.
- In the DELETE path the period date is URL-encoded except for `:`, so the URL is exactly
  `/scores/2026-08-01T00:00:00.000Z`, the form the user's HTTP Request node already used
  successfully.

---

## Behaviour worth knowing

- **Errors:** every request goes through `ninetyRequest`, which retries 429 up to 4 times
  (2s, 4s, 8s, 16s plus jitter, or `Retry-After` when present, capped at 30s) and re-throws
  everything else unchanged. `execute()` wraps API errors in `NodeApiError`; input validation
  throws `NodeOperationError` with the item index. Continue On Fail emits `{error}` per item.
- **Pagination of the KPI query (unverified):** the spec's `pageIndex` example is `0` but the
  response's `currentPage` is documented as 1-based. `getKpis` starts at 0, dedupes by `_id`, and
  stops on an empty page, a page with no new IDs, `totalCount` reached, or 50 pages. Whether
  Ninety accepts `pageSize: 100` has not been confirmed against the live API.
- **Period matching:** the Scorecard endpoint labels each period ("Q4", "Jan 06 - Jan 12") and
  the spec recommends matching on `label`, because period boundaries depend on the company's
  fiscal calendar and weekly start day. For writes, using a `periodStartDate` taken from Get Team
  Scorecard output is the safe choice.

---

## Not yet tested

Nothing here has been run against the live Ninety API or in an n8n instance. What was verified:
`npm run build` and `npm run lint` pass, and a mocked `execute()` produced exactly the URLs,
query strings and bodies of the three HTTP Request nodes this package replaces.

---

## Possible next steps (from the swagger, not built)

- Scorecard: `GET /v1/scorecard/kpis/{kpiId}/score` (one score by date), `PATCH
  /v1/scorecard/kpis/{kpiId}/scores/{periodStartDate}` (value, note or custom goal),
  Measurable notes, `POST /v1/scorecard/kpis/query` as an operation, KPI groups.
- Other resources in the spec: Issues, To-Dos, Rocks, Milestones, Teams, Users, Meetings,
  Headlines, V/TO, Accountability Chart, Seats, Conversations.
