# Changelog

## 0.1.0 (unreleased)

### Ninety (initial package)

- New **Ninety** action node and **Ninety API** credential (Personal Access Token, sent as a
  Bearer token).
- **Scorecard** resource:
  - **Get Team Scorecard** (`GET /v1/scorecard/team-scorecard`): Team and Period Interval, with
    optional Window or Date, and an Output choice of the whole Scorecard, one item per
    Measurable, or one item per score.
  - **Create or Update Score** (`POST /v1/scorecard/kpis/{kpiId}/scores`).
  - **Clear Score** (`DELETE /v1/scorecard/kpis/{kpiId}/scores/{periodStartDate}`).
- Team and Measurable dropdowns loaded from the account. On Create or Update Score and Delete
  Score, Team and Period Interval come first and filter the Measurable list.
- Period Start Date is a date picker; the picked date is sent as midnight UTC.
- Requests retry automatically on 429 Too Many Requests.
