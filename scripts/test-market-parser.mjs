import assert from 'node:assert/strict'

function parseMoney(input) {
  if (!input) return null
  const normalized = input.replace(/[,$\s]/g, '').trim()
  if (!normalized) return null
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : null
}

function parseBasis(input) {
  if (!input) return null
  const stripped = input.replace(/\s/g, '')
  if (!stripped) return null
  const sign = stripped.startsWith('-') ? -1 : 1
  const numericPart = stripped.replace(/[^\d.]/g, '')
  if (!numericPart) return null
  const value = Number.parseFloat(numericPart)
  return Number.isFinite(value) ? sign * value : null
}

function getInnerTextFromCells(rowHtml) {
  const cells = []
  const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis
  for (const match of rowHtml.matchAll(cellRegex)) {
    const text = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    cells.push(text)
  }
  return cells
}

function parseProducerAgBids(html) {
  const rows = []
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis
  for (const tr of html.matchAll(rowRegex)) {
    const cells = getInnerTextFromCells(tr[1])
    if (cells.length < 4) continue
    const line = cells.join(' | ').toUpperCase()
    if (!line.includes('CORN') && !line.includes('SOY') && !line.includes('WHEAT')) continue
    const cropCell = cells[0] ?? ''
    const crop = /SOY/i.test(cropCell) ? 'Soybeans' : /WHEAT/i.test(cropCell) ? 'Wheat' : /CORN/i.test(cropCell) ? 'Corn' : cropCell
    const futuresPrice = parseMoney(cells[2])
    const basis = parseBasis(cells[3])
    const cashPrice = cells.length > 4 ? parseMoney(cells[4]) : futuresPrice != null && basis != null ? futuresPrice + basis : null
    const note = cells[cells.length - 1] ?? null
    rows.push({
      crop,
      basis_month: cells[1] ?? null,
      futures_price: futuresPrice,
      basis,
      cash_price: cashPrice,
      note,
    })
  }
  return rows
}

function parseOptionMonthCode(optionMonth, nowYear = 2026) {
  if (!optionMonth) return null
  const monthMap = {
    F: 'Jan',
    G: 'Feb',
    H: 'Mar',
    J: 'Apr',
    K: 'May',
    M: 'Jun',
    N: 'Jul',
    Q: 'Aug',
    U: 'Sep',
    V: 'Oct',
    X: 'Nov',
    Z: 'Dec',
  }
  const trimmed = optionMonth.trim().toUpperCase()
  const match = trimmed.match(/^[A-Z]{2}([FGHJKMNQUVXZ])(\d)$/)
  if (!match) return optionMonth
  const yearDigit = Number.parseInt(match[2], 10)
  let year = Math.floor(nowYear / 10) * 10 + yearDigit
  if (year < nowYear - 2) year += 10
  if (year > nowYear + 7) year -= 10
  return `${monthMap[match[1]]} ${year}`
}

function parseFractionalFutures(input) {
  if (!input) return null
  const trimmed = input.trim()
  const match = trimmed.match(/^(\d+)-(\d+)$/)
  if (!match) return parseMoney(trimmed)
  const whole = Number.parseFloat(match[1])
  const frac = Number.parseFloat(match[2])
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
  return whole / 100 + frac / 800
}

function normalizeBasisValue(value) {
  if (value == null) return null
  if (Math.abs(value) > 10) return value / 100
  return value
}

function parseAdmFirstRow(html, crop) {
  const rows = []
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis
  for (const tr of html.matchAll(rowRegex)) {
    rows.push(getInnerTextFromCells(tr[1]))
  }
  const headerIndex = rows.findIndex((r) => r.join(' | ').toLowerCase().includes('option month') && r.join(' | ').toLowerCase().includes('futures'))
  if (headerIndex < 0 || headerIndex + 1 >= rows.length) return []
  const headers = rows[headerIndex].map((h) => h.toLowerCase())
  const firstData = rows[headerIndex + 1]
  const idx = (name, fallback) => {
    const i = headers.findIndex((h) => h.includes(name))
    return i >= 0 ? i : fallback
  }
  return [
    {
      crop,
      basis_month: parseOptionMonthCode(firstData[idx('option month', 1)]),
      futures_price: (() => {
        const raw = (firstData[idx('futures', 4)] ?? '').trim()
        return /^\d+-\d+$/.test(raw) ? parseFractionalFutures(raw) : parseMoney(raw) ?? parseFractionalFutures(raw)
      })(),
      basis: normalizeBasisValue(parseBasis(firstData[idx('basis', 3)])),
      cash_price: parseMoney(firstData[idx('cash', 2)]),
    },
  ]
}

const sampleHtml = `
<table>
  <tr><th>Commodity</th><th>Month</th><th>Futures</th><th>Basis</th><th>Cash</th><th>Note</th></tr>
  <tr><td>Corn</td><td>May</td><td>$4.50</td><td>-0.15</td><td>$4.35</td><td>CASH</td></tr>
  <tr><td>Corn</td><td>May</td><td>$4.50</td><td>-0.10</td><td>$4.40</td><td>FWD</td></tr>
  <tr><td>Soybeans</td><td>May</td><td>$11.20</td><td>+0.05</td><td>$11.25</td><td>CASH</td></tr>
</table>
`

const rows = parseProducerAgBids(sampleHtml)
assert.equal(rows.length, 3, 'parser should capture all crop rows')

const cashRows = rows.filter((row) => (row.note ?? '').toUpperCase().includes('CASH'))
assert.equal(cashRows.length, 2, 'CASH filter should keep only rows with CASH note')
assert.equal(cashRows[0].cash_price, 4.35, 'cash price should parse from explicit cash column')
assert.equal(cashRows[0].futures_price + cashRows[0].basis, 4.35, 'futures + basis should match parsed cash')

assert.equal(parseOptionMonthCode('ZCK6'), 'May 2026', 'ZCK6 should map to May 2026')
assert.equal(parseOptionMonthCode('ZCN6'), 'Jul 2026', 'ZCN6 should map to Jul 2026')

const admHtml = `
<table>
  <tr><th>Delivery</th><th>Option Month</th><th>Cash</th><th>Basis</th><th>Futures</th><th>Futures Change</th></tr>
  <tr><td>04/01/2026</td><td>ZCK6</td><td>$3.94</td><td>-54</td><td>448-0</td><td>-0.01</td></tr>
  <tr><td>05/01/2026</td><td>ZCN6</td><td>$4.10</td><td>-0.50</td><td>$4.60</td><td>+0.01</td></tr>
</table>
`
const admRows = parseAdmFirstRow(admHtml, 'Corn')
assert.equal(admRows.length, 1, 'ADM parser should keep only the first row')
assert.equal(admRows[0].basis_month, 'May 2026', 'ADM basis month should parse from option month')
assert.equal(admRows[0].cash_price, 3.94, 'ADM cash price should be parsed from first row')
assert.equal(admRows[0].basis, -0.54, 'ADM basis should normalize cents value to dollars')
assert.equal(admRows[0].futures_price, 4.48, 'ADM futures should parse fractional format')

console.log('market parser tests passed')
