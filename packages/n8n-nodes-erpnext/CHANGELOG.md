# Changelog

## 0.1.0

First release.

- **ERPNext** node, Document resource for any DocType: Get (with an option to return
  `{found: false}` instead of failing), Get Many (filters, or filters, fields, order by, return
  all), Create, Update, Create or Update (match field plus fallback field), and Delete.
- **Skip If Unchanged** option on Update and Create or Update (on by default). Fields are
  compared after normalizing: empty and null are equal, booleans match Check fields (0/1), a
  number matches its numeric string, and child tables compare as unordered rows on the columns
  sent.
- **Method** resource: call a whitelisted server method by GET or POST.
- **ERPNext Trigger** (polling): New, Updated, or New or Updated documents of a DocType, with
  filters, optional child tables, a lookback window with dedupe, ignored users, and a per-poll
  cap. Manual runs return the latest matching documents (useful for backfills).
- **ERPNext Token API** credential (`erpNextTokenApi`).
- Retries 429/502/503/504 with backoff; unpacks ERPNext error messages.
