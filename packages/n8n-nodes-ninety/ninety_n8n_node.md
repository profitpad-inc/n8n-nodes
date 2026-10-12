# @profitpad-inc/n8n-nodes-ninety: node reference (v0.1.0)

Custom n8n community node package for the Ninety public API. **Use this node instead of
HTTP Request nodes against `api.public.ninety.io`** when generating workflow JSON for Ninety
automation in this environment.

Package name: `@profitpad-inc/n8n-nodes-ninety`

---

## 1. Node type identifier

| Internal `name` | Full `type` string in workflow JSON | `displayName` | Kind |
|---|---|---|---|
| `ninety` | `@profitpad-inc/n8n-nodes-ninety.ninety` | Ninety | Action |

`typeVersion: 1`. Declares `usableAsTool: true`.

If the package is installed in a custom extensions folder rather than as a community package,
the type string is `CUSTOM.ninety` instead.

---

## 2. Credential

- Type name: **`ninetyApi`** (displayName "Ninety API")
- Fields:
  - `notes` (string, optional): free text, not sent in requests
  - `accessToken` (string, password, **required**): Ninety Personal Access Token
- Auth: `Authorization: Bearer <accessToken>`
- Reference in a node's JSON:
  ```json
  "credentials": {
    "ninetyApi": { "id": "<credential-id>", "name": "<credential-name>" }
  }
  ```

---

## 3. Action node `ninety`

Top level: `resource` = `scorecard` (only option, default).

### 3.1 resource = scorecard

| Parameter | Used by | Notes |
|---|---|---|
| `operation` | all | `getTeamScorecard` (default), `upsertScore` (shown as "Create or Update Score"), `deleteScore` (shown as "Clear Score") |
| `teamId` | all | Team ID. UI dropdown from `GET /v1/teams/available`. Required for getTeamScorecard; for upsertScore / deleteScore it is optional and only filters the `kpiId` dropdown (not sent with the request) |
| `periodInterval` | all | `weekly` (default), `monthly`, `quarterly`, `annual`. For upsertScore / deleteScore it only filters the `kpiId` dropdown |
| `outputMode` | getTeamScorecard | `scorecard` (default, one item), `kpis` (one item per Measurable), `scores` (one item per Measurable per period) |
| `additionalOptions.window` | getTeamScorecard | `default`, `qtd`, `ytd`, `currentQuarter`, `currentYear`. Ignored when `date` is set |
| `additionalOptions.date` | getTeamScorecard | `YYYY-MM-DD`; returns only the period containing it |
| `kpiId` | upsertScore, deleteScore | Measurable ID (required). UI dropdown from `POST /v1/scorecard/kpis/query` |
| `periodStartDate` | upsertScore, deleteScore | Date picker (`dateTime`). First day of the period, e.g. `2026-08-01T00:00:00` (picker format), `2026-08-01`, or `2026-08-01T00:00:00.000Z`. Values without a timezone are sent as that date at midnight UTC (time ignored); values with `Z` or an offset are converted to UTC |
| `value` | upsertScore | Number (required) |

### 3.2 Output shapes

- `getTeamScorecard`, `outputMode = scorecard`:
  `{id, name, periodInterval, teamId, periods: [{label, periodStartDate, isFuture, partialInterval}], groups: [{id, name, kpis: [{id, title, unit, currency, ownerName, defaultGoal, average, total, scores: [...]}]}]}`
- `outputMode = kpis`: per Measurable
  `{scorecardId, scorecardName, periodInterval, teamId, groupId, groupName, kpiId, kpiTitle, unit, currency, ownerName, defaultGoal, average, total, scores: [{label, periodStartDate, isFuture, partialInterval, value, goal, note}]}`
- `outputMode = scores`: per Measurable per period
  `{scorecardId, scorecardName, periodInterval, teamId, groupId, groupName, kpiId, kpiTitle, unit, currency, ownerName, defaultGoal, label, periodStartDate, isFuture, partialInterval, value, goal, note}`.
  `value` is `null` when no score has been entered.
- `upsertScore`: Ninety's response, `{id, value, periodStartDate}`.
- `deleteScore`: `{deleted: true, kpiId, periodStartDate}`.

Field lists come from the API's swagger; fields Ninety leaves out of a response are absent.

---

## 4. Examples

Read a Team's monthly Scorecard:

```json
{
  "parameters": {
    "resource": "scorecard",
    "operation": "getTeamScorecard",
    "teamId": "610c66449308d70009540bcf",
    "periodInterval": "monthly",
    "outputMode": "scorecard",
    "additionalOptions": {}
  },
  "type": "@profitpad-inc/n8n-nodes-ninety.ninety",
  "typeVersion": 1,
  "name": "Ninety list scorecard for team",
  "credentials": { "ninetyApi": { "id": "<credential-id>", "name": "<credential-name>" } }
}
```

Set a Measurable's score for August 2026:

```json
{
  "parameters": {
    "resource": "scorecard",
    "operation": "upsertScore",
    "teamId": "610c66449308d70009540bcf",
    "periodInterval": "monthly",
    "kpiId": "67a4e0bbe627c75c5ef718f6",
    "periodStartDate": "2026-08-01T00:00:00.000Z",
    "value": 101
  },
  "type": "@profitpad-inc/n8n-nodes-ninety.ninety",
  "typeVersion": 1,
  "name": "Ninety update KPI score",
  "credentials": { "ninetyApi": { "id": "<credential-id>", "name": "<credential-name>" } }
}
```

Clear that score:

```json
{
  "parameters": {
    "resource": "scorecard",
    "operation": "deleteScore",
    "teamId": "610c66449308d70009540bcf",
    "periodInterval": "monthly",
    "kpiId": "67a4e0bbe627c75c5ef718f6",
    "periodStartDate": "2026-08-01T00:00:00.000Z"
  },
  "type": "@profitpad-inc/n8n-nodes-ninety.ninety",
  "typeVersion": 1,
  "name": "Ninety clear KPI score",
  "credentials": { "ninetyApi": { "id": "<credential-id>", "name": "<credential-name>" } }
}
```
