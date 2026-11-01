# Changelog

## Unreleased

- Trigger and session creation: retries now wait 1s, 3s, then 8s between attempts (previously all 3 attempts fired instantly), retry only on 5xx, 429, or network errors, and the trigger mints a fresh session token before each retry. Fixes intermittent "Request failed with status code 500" poll errors that succeeded when re-run moments later.
- Trigger: reuses the Eclipse session token across polls instead of logging in on every poll. The token is shared by all triggers using the same login, replaced after 30 minutes, and replaced right away if a request using it fails. This removes most calls to Eclipse's login endpoint, which was the call intermittently failing with 500/504.
- Credential: the Epicor Eclipse credential can now be used in the HTTP Request node (Authentication → Predefined Credential Type). It logs in automatically, adds the `sessionToken` header, keeps the token on the credential, and logs in again when Eclipse returns 401.
- Security: failed Eclipse logins no longer expose the username and password. Previously the raw HTTP error, including the login request body, was saved in execution data and passed to error workflows. Login errors now read "Eclipse login (POST /Sessions) failed with status code N", with Eclipse's response in the description and the status as a separate `httpCode` field (e.g. `"500"`, readable in error workflows as `$json.trigger.error.httpCode`).

## 0.1.56

- Sales Order Trigger: reverted the rolling lookback back to taking whichever of the last poll time or the configured Lookback Window is earlier, on every poll (not just the first), at a user's request for a workflow that's idempotent downstream.
- Sales Order Trigger: added a "Poll Buffer (Minutes)" field that shifts the whole polling window (both start and, for Sales Order, end) back by a configurable number of minutes, to work around Eclipse returning inconsistent results for very recently modified records. Fixes a 400 "LastModifiedDateAndTimeStampStart can not be greater than LastModifiedDateAndTimeStampEnd" error that occurred when a manually-set End date filter used a fixed offset shorter than the actual poll interval.

## 0.1.48

- Fixed Customer Create/Update, Contact Create/Update, and Create Sales Order JSON fields (`customJson`, `updateCustomJson`, `salesOrderCustomJson`) throwing when fed an object via a whole-field expression (e.g. `={{ $json.someObject }}`) instead of a manually-typed JSON string. These fields now use `parseJsonParameter()`, matching the fix already applied to the Update Line Item Price/Quantity JSON fields.

## 0.1.40

- Added Sales Order line item operations: Create Line Item, Update Line Item Price, Update Line Item Quantity, Delete Line Item.
