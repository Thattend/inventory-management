/**
 * Unit tests for client/src/utils/csv.js.
 * Run from the repo root: node --test tests/frontend/csv.test.mjs
 * (Node's built-in test runner; no extra dependencies.)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeCsvCell, toCsv, buildCsvFilename } from '../../client/src/utils/csv.js'

test('plain values are left unquoted', () => {
  assert.equal(escapeCsvCell('PCB-001'), 'PCB-001')
  assert.equal(escapeCsvCell(42), '42')
  assert.equal(escapeCsvCell(24.99), '24.99')
})

test('null and undefined become empty cells', () => {
  assert.equal(escapeCsvCell(null), '')
  assert.equal(escapeCsvCell(undefined), '')
})

test('commas, quotes and line breaks are quoted per RFC 4180', () => {
  assert.equal(escapeCsvCell('Motor, 5HP'), '"Motor, 5HP"')
  assert.equal(escapeCsvCell('12" Panel'), '"12"" Panel"')
  assert.equal(escapeCsvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(escapeCsvCell('line1\r\nline2'), '"line1\r\nline2"')
})

test('text that a spreadsheet would run as a formula is neutralised', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)")
  assert.equal(escapeCsvCell('+cmd'), "'+cmd")
  assert.equal(escapeCsvCell('-1+1'), "'-1+1")
  assert.equal(escapeCsvCell('@SUM(1)'), "'@SUM(1)")
  assert.equal(escapeCsvCell('\tTAB'), "'\tTAB")
  // Neutralised values that also need quoting are both prefixed and quoted
  assert.equal(escapeCsvCell('=A1,B1'), "\"'=A1,B1\"")
})

test('real numbers keep their sign so spreadsheets read them as numbers', () => {
  assert.equal(escapeCsvCell(-5), '-5')
  assert.equal(escapeCsvCell(-0.5), '-0.5')
})

test('toCsv writes a header row and one row per item using column accessors', () => {
  const columns = [
    { header: 'SKU', value: (row) => row.sku },
    { header: 'Qty', value: (row) => row.qty }
  ]
  const rows = [{ sku: 'A-1', qty: 3 }, { sku: 'B, 2', qty: 0 }]
  assert.equal(toCsv(columns, rows), 'SKU,Qty\r\nA-1,3\r\n"B, 2",0\r\n')
})

test('toCsv escapes headers too', () => {
  const columns = [{ header: 'Name, full', value: (row) => row.name }]
  assert.equal(toCsv(columns, [{ name: 'x' }]), '"Name, full"\r\nx\r\n')
})

test('toCsv with no rows still returns the header row', () => {
  const columns = [{ header: 'SKU', value: (row) => row.sku }]
  assert.equal(toCsv(columns, []), 'SKU\r\n')
})

test('toCsv does not modify its inputs', () => {
  const columns = Object.freeze([Object.freeze({ header: 'SKU', value: (row) => row.sku })])
  const rows = Object.freeze([Object.freeze({ sku: 'A-1' })])
  assert.doesNotThrow(() => toCsv(columns, rows))
})

test('buildCsvFilename uses the local date', () => {
  const date = new Date(2026, 10, 3, 23, 30) // 3 Nov 2026, local time
  assert.equal(buildCsvFilename('inventory', date), 'inventory-2026-11-03.csv')
})
