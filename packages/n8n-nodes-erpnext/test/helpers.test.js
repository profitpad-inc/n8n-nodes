// Unit tests for the pure helpers that decide whether a sync writes anything
// and whether the trigger emits a document. Run against the built output:
//   npm run build && npm test
const test = require('node:test');
const assert = require('node:assert/strict');

const {
	diffFields,
	valuesEqual,
	parseFrappeDatetime,
	formatFrappeDatetime,
	windowStartFrom,
	latestDatetime,
	selectUnseen,
	describeErpNextError,
} = require('../dist/nodes/ErpNext/helpers.js');

test('empty values are all the same value', () => {
	assert.equal(valuesEqual('', null), true);
	assert.equal(valuesEqual(null, undefined), true);
	assert.equal(valuesEqual('  ', ''), true);
	assert.equal(valuesEqual('x', ''), false);
});

test('booleans compare against Check fields (0/1)', () => {
	assert.equal(valuesEqual(true, 1), true);
	assert.equal(valuesEqual(false, 0), true);
	assert.equal(valuesEqual(true, 0), false);
});

test('a number equals its numeric string, but IDs keep leading zeros', () => {
	assert.equal(valuesEqual(5, '5'), true);
	assert.equal(valuesEqual('5.0', 5), true);
	assert.equal(valuesEqual('007', '7'), false);
	assert.equal(valuesEqual('abc', 0), false);
});

test('strings are trimmed but stay case-sensitive', () => {
	assert.equal(valuesEqual(' Palmer Productions Ltd. ', 'Palmer Productions Ltd.'), true);
	assert.equal(valuesEqual('palmer', 'Palmer'), false);
});

test('child tables compare as unordered rows, on the columns sent only', () => {
	const stored = [
		{ name: 'x1', idx: 1, parent: 'C-1', email_id: 'b@x.com', is_primary: 0 },
		{ name: 'x2', idx: 2, parent: 'C-1', email_id: 'a@x.com', is_primary: 1 },
	];
	assert.equal(
		valuesEqual(
			[
				{ email_id: 'a@x.com', is_primary: 1 },
				{ email_id: 'b@x.com', is_primary: 0 },
			],
			stored,
		),
		true,
	);
	assert.equal(valuesEqual([{ email_id: 'a@x.com', is_primary: 1 }], stored), false);
	assert.equal(
		valuesEqual(
			[
				{ email_id: 'a@x.com', is_primary: 0 },
				{ email_id: 'b@x.com', is_primary: 1 },
			],
			stored,
		),
		false,
	);
	assert.equal(valuesEqual([], undefined), true);
});

test('diffFields reports only the fields that differ', () => {
	const current = { name: 'C-1', customer_name: 'Grant Plastics Ltd.', website: '', disabled: 0 };
	assert.deepEqual(
		diffFields({ customer_name: 'Grant Plastics Ltd.', disabled: false }, current),
		[],
	);
	assert.deepEqual(diffFields({ website: 'grant.example', doctype: 'Customer' }, current), [
		{ field: 'website', from: '', to: 'grant.example' },
	]);
});

test('Frappe datetimes round-trip with and without a fraction', () => {
	const withFraction = '2026-09-30 16:50:18.861987';
	assert.equal(formatFrappeDatetime(parseFrappeDatetime(withFraction)), withFraction);
	assert.equal(
		formatFrappeDatetime(parseFrappeDatetime('2026-09-30 16:50:18')),
		'2026-09-30 16:50:18.000000',
	);
	assert.ok(
		parseFrappeDatetime('2026-09-30 16:50:18') < parseFrappeDatetime('2026-09-30 16:50:18.000001'),
	);
	assert.equal(parseFrappeDatetime('not a date'), undefined);
});

test('the lookback window crosses minute, hour and day boundaries', () => {
	assert.equal(windowStartFrom('2026-10-01 00:00:30.5', 60), '2026-09-30 23:59:30.500000');
	assert.equal(windowStartFrom('2026-09-30 16:50:18.861987', 0), '2026-09-30 16:50:18.861987');
});

test('latestDatetime keeps the newest value and never goes backwards', () => {
	const docs = [{ modified: '2026-09-30 10:00:00.5' }, { modified: '2026-09-30 10:00:01' }];
	assert.equal(latestDatetime(docs, 'modified', '2026-09-30 09:00:00'), '2026-09-30 10:00:01');
	assert.equal(latestDatetime(docs, 'modified', '2026-09-30 11:00:00'), '2026-09-30 11:00:00');
	assert.equal(latestDatetime([], 'modified', undefined), undefined);
});

test('selectUnseen skips what an overlapping poll already emitted', () => {
	const emitted = {};
	const first = [
		{ name: 'A', modified: '2026-09-30 10:00:00' },
		{ name: 'B', modified: '2026-09-30 10:00:05' },
	];
	assert.equal(selectUnseen(first, emitted, '2026-09-30 09:59:00').length, 2);

	// Next poll re-reads the overlap: A unchanged, B saved again, C new.
	const second = [
		{ name: 'A', modified: '2026-09-30 10:00:00' },
		{ name: 'B', modified: '2026-09-30 10:00:40' },
		{ name: 'C', modified: '2026-09-30 10:00:41' },
	];
	const unseen = selectUnseen(second, emitted, '2026-09-30 09:59:30');
	assert.deepEqual(
		unseen.map((doc) => doc.name),
		['B', 'C'],
	);
});

test('selectUnseen prunes entries older than the window', () => {
	const emitted = { 'OLD|2026-09-30 08:00:00': parseFrappeDatetime('2026-09-30 08:00:00') };
	selectUnseen([], emitted, '2026-09-30 09:00:00');
	assert.deepEqual(emitted, {});
});

test('describeErpNextError pulls the message out of _server_messages', () => {
	const body = {
		exception: 'frappe.exceptions.ValidationError: fallback',
		_server_messages: JSON.stringify([
			JSON.stringify({ message: 'Customer <b>X</b> already exists' }),
		]),
	};
	assert.equal(describeErpNextError({ response: { data: body } }), 'Customer X already exists');
	assert.equal(
		describeErpNextError({
			description: JSON.stringify({
				exception: 'frappe.exceptions.DoesNotExistError: Customer Y not found',
			}),
		}),
		'Customer Y not found',
	);
	assert.equal(describeErpNextError({}), undefined);
});
