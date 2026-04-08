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

console.log('market parser tests passed')
