# Changelog

## 0.1.56

- Sales Order Trigger: reverted the rolling lookback back to taking whichever of the last poll time or the configured Lookback Window is earlier, on every poll (not just the first), at a user's request for a workflow that's idempotent downstream.
- Sales Order Trigger: added a "Poll Buffer (Minutes)" field that shifts the whole polling window (both start and, for Sales Order, end) back by a configurable number of minutes, to work around Eclipse returning inconsistent results for very recently modified records. Fixes a 400 "LastModifiedDateAndTimeStampStart can not be greater than LastModifiedDateAndTimeStampEnd" error that occurred when a manually-set End date filter used a fixed offset shorter than the actual poll interval.

## 0.1.48

- Fixed Customer Create/Update, Contact Create/Update, and Create Sales Order JSON fields (`customJson`, `updateCustomJson`, `salesOrderCustomJson`) throwing when fed an object via a whole-field expression (e.g. `={{ $json.someObject }}`) instead of a manually-typed JSON string. These fields now use `parseJsonParameter()`, matching the fix already applied to the Update Line Item Price/Quantity JSON fields.

## 0.1.40

- Added Sales Order line item operations: Create Line Item, Update Line Item Price, Update Line Item Quantity, Delete Line Item.
