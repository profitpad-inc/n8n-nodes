# Changelog

## 0.1.48

- Fixed Customer Create/Update, Contact Create/Update, and Create Sales Order JSON fields (`customJson`, `updateCustomJson`, `salesOrderCustomJson`) throwing when fed an object via a whole-field expression (e.g. `={{ $json.someObject }}`) instead of a manually-typed JSON string. These fields now use `parseJsonParameter()`, matching the fix already applied to the Update Line Item Price/Quantity JSON fields.

## 0.1.40

- Added Sales Order line item operations: Create Line Item, Update Line Item Price, Update Line Item Quantity, Delete Line Item.
