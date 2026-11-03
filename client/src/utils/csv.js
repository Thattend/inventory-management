/**
 * CSV helpers for client-side exports.
 *
 * toCsv / escapeCsvCell / buildCsvFilename are pure and unit-tested
 * (tests/frontend/csv.test.mjs). downloadCsv is the only function that
 * touches the DOM.
 */

const LINE_BREAK = '\r\n' // RFC 4180 line ending; Excel and Numbers both accept it

// A text cell starting with one of these is run as a formula by Excel,
// LibreOffice and Google Sheets ("CSV injection"). Prefixing an apostrophe
// makes the spreadsheet treat it as plain text.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

// Byte order mark so Excel detects UTF-8 and shows Japanese text correctly.
const UTF8_BOM = '﻿'

/**
 * Turn one value into a safe CSV cell.
 * Numbers are written as-is so spreadsheets keep them numeric (including
 * negatives); only text is checked for formula triggers.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''

  const isText = typeof value === 'string'
  const raw = String(value)
  const text = isText && FORMULA_TRIGGERS.some((trigger) => raw.startsWith(trigger))
    ? `'${raw}`
    : raw

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Build CSV text from column definitions and rows.
 * @param {Array<{header: string, value: (row: any) => any}>} columns
 * @param {Array<any>} rows
 * @returns {string} CSV with a header row; every line ends with CRLF
 */
export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(',')
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(',')
  )
  return [header, ...lines].map((line) => line + LINE_BREAK).join('')
}

/** "<prefix>-YYYY-MM-DD.csv" using the user's local date. */
export function buildCsvFilename(prefix, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${prefix}-${day}.csv`
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename, csvText) {
  const blob = new Blob([UTF8_BOM + csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Revoke after the click has been handled so the download can start
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
