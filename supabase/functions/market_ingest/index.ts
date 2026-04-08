import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRODUCER_AG_URL = 'https://www.producerag.com/locations/buhler'
const PRODUCER_AG_CASHBIDS_URL =
  'https://tmagrain.agricharts.com/inc/cashbids/cashbids-js.php?filter=location&location=2999&commodity=&groupby=location&width=&showchart=1&hidenav=1&format=table&fields=name%2Cbasismonth%2Cfutures%2Cfutureschange%2Cbasis%2Cprice%2Cnotes%2C&groupheading=table&bidsort=commodity&dateformat=%25m%2F%25d%2F%25Y&months=8&noscript=1&acCnt=1'
const ADM_COMMODITY_SOURCES = [
  { crop: 'Corn', commodity: '02', url: 'https://adm.gradable.com/market/Hutchinson--KS?commodity=02' },
  { crop: 'Soybeans', commodity: '01', url: 'https://adm.gradable.com/market/Hutchinson--KS?commodity=01' },
  { crop: 'Wheat', commodity: '16', url: 'https://adm.gradable.com/market/Hutchinson--KS?commodity=16' },
  { crop: 'Milo', commodity: '37', url: 'https://adm.gradable.com/market/Hutchinson--KS?commodity=37' },
] as const
const ADM_MARKET_ID = '331847185'
const ADM_MARKET_URL = 'https://adm.gradable.com/market/Hutchinson--KS'
const ADM_INSTRUMENTS_URL = `https://adm.gradable.com/api/commodities/v2/merchandising/instruments/market/${ADM_MARKET_ID}?offer_type=public`
const YAHOO_TICKERS = [
  { ticker: 'ZC=F', crop: 'Corn' },
  { ticker: 'ZS=F', crop: 'Soybeans' },
  { ticker: 'KE=F', crop: 'Wheat' },
] as const
const YAHOO_INTERVALS = ['1m', '5m', '1h', '1d'] as const

type LocalBidRow = {
  crop: string
  basis_month: string | null
  futures_price: number | null
  basis: number | null
  cash_price: number | null
  note: string | null
  source_url?: string
}

function parseMoney(input: string | null | undefined): number | null {
  if (!input) return null
  const normalized = input.replace(/[,$\s]/g, '').trim()
  if (!normalized) return null
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : null
}

function parseBasis(input: string | null | undefined): number | null {
  if (!input) return null
  const stripped = input.replace(/\s/g, '')
  if (!stripped) return null
  const sign = stripped.startsWith('-') ? -1 : 1
  const numericPart = stripped.replace(/[^\d.]/g, '')
  if (!numericPart) return null
  const value = Number.parseFloat(numericPart)
  return Number.isFinite(value) ? sign * value : null
}

function getInnerTextFromCells(rowHtml: string): string[] {
  const cells: string[] = []
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

function parseProducerAgBids(html: string): LocalBidRow[] {
  const rows: LocalBidRow[] = []
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis
  for (const tr of html.matchAll(rowRegex)) {
    const cells = getInnerTextFromCells(tr[1])
    if (cells.length < 4) continue
    const line = cells.join(' | ').toUpperCase()
    if (!line.includes('CORN') && !line.includes('SOY') && !line.includes('WHEAT')) continue

    const cropCell = cells[0] ?? ''
    const crop =
      /SOY/i.test(cropCell) ? 'Soybeans' : /WHEAT/i.test(cropCell) ? 'Wheat' : /CORN/i.test(cropCell) ? 'Corn' : cropCell
    const basisMonth = cells[1] ?? null
    const futuresPrice = parseMoney(cells[2])
    const basis = parseBasis(cells[3])
    const note = cells[cells.length - 1] ?? null
    const cashPrice = cells.length > 4 ? parseMoney(cells[4]) : futuresPrice != null && basis != null ? futuresPrice + basis : null

    rows.push({
      crop,
      basis_month: basisMonth,
      futures_price: futuresPrice,
      basis,
      cash_price: cashPrice,
      note,
    })
  }
  return rows
}

function parseFractionalFutures(input: string | null | undefined): number | null {
  if (!input) return null
  const trimmed = input.trim()
  const match = trimmed.match(/^(\d+)-(\d+)$/)
  if (!match) {
    return parseMoney(trimmed)
  }
  const whole = Number.parseFloat(match[1])
  const frac = Number.parseFloat(match[2])
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
  return whole / 100 + frac / 800
}

function normalizeBasisValue(value: number | null): number | null {
  if (value == null) return null
  // ADM sometimes presents basis as cents (-54) instead of dollars (-0.54).
  if (Math.abs(value) > 10) return value / 100
  return value
}

function parseOptionMonthCode(optionMonth: string | null | undefined): string | null {
  if (!optionMonth) return null
  const monthMap: Record<string, string> = {
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
  const month = monthMap[match[1]]
  if (!month) return optionMonth
  const yearDigit = Number.parseInt(match[2], 10)
  if (!Number.isFinite(yearDigit)) return optionMonth
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  let year = Math.floor(currentYear / 10) * 10 + yearDigit
  if (year < currentYear - 2) year += 10
  if (year > currentYear + 7) year -= 10
  return `${month} ${year}`
}

function parseAgrichartsPayload(payload: string): LocalBidRow[] {
  const match = payload.match(/var bids = (\[.*?\]);var config =/s)
  if (!match) return []
  let parsed: Array<{ cashbids?: Array<Record<string, unknown>> }> = []
  try {
    parsed = JSON.parse(match[1])
  } catch {
    return []
  }
  const rows: LocalBidRow[] = []
  for (const location of parsed) {
    for (const bid of location.cashbids ?? []) {
      const crop = String(bid.name ?? '').trim()
      if (!crop) continue
      rows.push({
        crop,
        basis_month: bid.basismonth ? String(bid.basismonth) : null,
        futures_price: parseFractionalFutures((bid.futuresprice as string | undefined) ?? (bid.futures as string | undefined)),
        basis: typeof bid.basis === 'number' ? bid.basis / 100 : parseBasis(String(bid.basis ?? '')),
        cash_price: parseMoney((bid.cashprice as string | undefined) ?? (bid.price as string | undefined)),
        note: bid.notes ? String(bid.notes) : null,
      })
    }
  }
  return rows
}

type AdmInstrument = {
  ext_commodity_id?: string
  option_month?: string | null
  futures_bid?: number | null
  basis_bid?: number | null
  cash_bid?: number | null
  display_name?: string | null
  delivery_period_start?: number | null
}

type AdmInstrumentsResponse = {
  instruments?: AdmInstrument[]
}

function parseAdmApiRows(payload: AdmInstrumentsResponse): LocalBidRow[] {
  const instruments = payload.instruments ?? []
  const rows: LocalBidRow[] = []
  for (const source of ADM_COMMODITY_SOURCES) {
    const matches = instruments
      .filter((item) => String(item.ext_commodity_id ?? '') === source.commodity)
      .sort((a, b) => (a.delivery_period_start ?? Number.MAX_SAFE_INTEGER) - (b.delivery_period_start ?? Number.MAX_SAFE_INTEGER))
    const first = matches[0]
    if (!first) continue
    rows.push({
      crop: source.crop,
      basis_month: parseOptionMonthCode(first.option_month ?? null),
      futures_price: typeof first.futures_bid === 'number' ? first.futures_bid : null,
      basis: normalizeBasisValue(typeof first.basis_bid === 'number' ? first.basis_bid : null),
      cash_price: typeof first.cash_bid === 'number' ? first.cash_bid : null,
      note: first.display_name ?? 'FIRST_ROW',
      source_url: source.url,
    })
  }
  return rows
}

async function runIngest() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const nowIso = new Date().toISOString()

  const { data: runRow, error: runInsertErr } = await supabase
    .from('market_sync_runs')
    .insert({ source: 'market_ingest', status: 'started', started_at: nowIso, meta: { location: 'buhler' } } as never)
    .select('id')
    .single()

  if (runInsertErr || !runRow) throw new Error(runInsertErr?.message ?? 'Failed to create market_sync_runs row')
  const runId = runRow.id as number

  let rowsWritten = 0
  try {
    const producerResponse = await fetch(PRODUCER_AG_CASHBIDS_URL, {
      headers: { 'User-Agent': 'AgriFlowMarketIngest/1.0' },
    })
    if (!producerResponse.ok) {
      throw new Error(`Producer Ag cashbids fetch failed: ${producerResponse.status}`)
    }
    const scriptPayload = await producerResponse.text()
    let parsedRows = parseAgrichartsPayload(scriptPayload)
    if (parsedRows.length === 0) {
      const fallbackResp = await fetch(PRODUCER_AG_URL, {
        headers: { 'User-Agent': 'AgriFlowMarketIngest/1.0' },
      })
      if (fallbackResp.ok) {
        const fallbackHtml = await fallbackResp.text()
        parsedRows = parseProducerAgBids(fallbackHtml)
      }
    }
    if (parsedRows.length === 0) throw new Error('Producer Ag parser returned 0 rows')

    const rawRows = parsedRows.map((row) => ({
      location_slug: 'buhler',
      crop: row.crop,
      basis_month: row.basis_month,
      futures_price: row.futures_price,
      basis: row.basis,
      cash_price: row.cash_price,
      note: row.note,
      source_url: PRODUCER_AG_URL,
      observed_at: nowIso,
      scraped_at: nowIso,
      raw_payload: row,
    }))
    const { error: rawErr } = await supabase.from('market_local_bids_raw').insert(rawRows as never)
    if (rawErr) throw new Error(`Failed writing raw bids: ${rawErr.message}`)
    rowsWritten += rawRows.length

    const cashRows = parsedRows.filter((row) => (row.note ?? '').toUpperCase().includes('CASH'))
    const currentRows = cashRows.map((row) => ({
      location_slug: 'buhler',
      crop: row.crop,
      basis_month: row.basis_month,
      futures_price: row.futures_price,
      basis: row.basis,
      cash_price: row.cash_price ?? (row.futures_price != null && row.basis != null ? row.futures_price + row.basis : null),
      note: row.note,
      source_url: PRODUCER_AG_URL,
      last_updated: nowIso,
    }))
    if (currentRows.length > 0) {
      const { error: currentErr } = await supabase
        .from('market_local_bids_current')
        .upsert(currentRows as never, { onConflict: 'location_slug,crop' })
      if (currentErr) throw new Error(`Failed upserting current bids: ${currentErr.message}`)
      rowsWritten += currentRows.length
    }

    const admErrors: string[] = []
    let admRows: LocalBidRow[] = []
    try {
      const admResp = await fetch(ADM_INSTRUMENTS_URL, {
        headers: {
          'User-Agent': 'AgriFlowMarketIngest/1.0',
          Referer: `${ADM_MARKET_URL}/`,
          Accept: 'application/json',
        },
      })
      if (!admResp.ok) {
        throw new Error(`ADM API fetch failed: ${admResp.status}`)
      }
      const payload = (await admResp.json()) as AdmInstrumentsResponse
      admRows = parseAdmApiRows(payload)
      if (admRows.length === 0) {
        admErrors.push('ADM API returned 0 mapped rows')
      }
    } catch (error) {
      admErrors.push(`ADM API exception: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (admRows.length > 0) {
      const admRawRows = admRows.map((row) => ({
        location_slug: 'adm-hutchinson',
        crop: row.crop,
        basis_month: row.basis_month,
        futures_price: row.futures_price,
        basis: row.basis,
        cash_price: row.cash_price,
        note: row.note,
        source_url: row.source_url ?? 'https://adm.gradable.com/market/Hutchinson--KS',
        observed_at: nowIso,
        scraped_at: nowIso,
        raw_payload: row,
      }))
      const { error: admRawErr } = await supabase.from('market_local_bids_raw').insert(admRawRows as never)
      if (admRawErr) throw new Error(`Failed writing ADM raw bids: ${admRawErr.message}`)
      rowsWritten += admRawRows.length

      const admCurrentRows = admRows.map((row) => ({
        location_slug: 'adm-hutchinson',
        crop: row.crop,
        basis_month: row.basis_month,
        futures_price: row.futures_price,
        basis: row.basis,
        cash_price: row.cash_price ?? (row.futures_price != null && row.basis != null ? row.futures_price + row.basis : null),
        note: row.note,
        source_url: row.source_url ?? 'https://adm.gradable.com/market/Hutchinson--KS',
        last_updated: nowIso,
      }))
      const { error: admCurrentErr } = await supabase
        .from('market_local_bids_current')
        .upsert(admCurrentRows as never, { onConflict: 'location_slug,crop' })
      if (admCurrentErr) throw new Error(`Failed upserting ADM current bids: ${admCurrentErr.message}`)
      rowsWritten += admCurrentRows.length
    }

    for (const item of YAHOO_TICKERS) {
      for (const interval of YAHOO_INTERVALS) {
        const range = interval === '1m' ? '1d' : interval === '5m' ? '5d' : interval === '1h' ? '1mo' : '1y'
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.ticker)}`)
        url.searchParams.set('range', range)
        url.searchParams.set('interval', interval)
        url.searchParams.set('includePrePost', 'false')
        url.searchParams.set('events', 'div,splits')

        const res = await fetch(url.toString(), {
          headers: { 'User-Agent': 'AgriFlowMarketIngest/1.0' },
        })
        if (!res.ok) throw new Error(`Yahoo fetch failed for ${item.ticker}/${interval}: ${res.status}`)
        const json = await res.json()
        const result = json?.chart?.result?.[0]
        const timestamps: number[] = result?.timestamp ?? []
        const quote = result?.indicators?.quote?.[0] ?? {}
        const opens: Array<number | null> = quote.open ?? []
        const highs: Array<number | null> = quote.high ?? []
        const lows: Array<number | null> = quote.low ?? []
        const closes: Array<number | null> = quote.close ?? []
        const volumes: Array<number | null> = quote.volume ?? []
        if (timestamps.length === 0) continue

        const snapshotRows = timestamps.map((ts, idx) => ({
          ticker: item.ticker,
          crop: item.crop,
          interval,
          point_time: new Date(ts * 1000).toISOString(),
          open: opens[idx] ?? null,
          high: highs[idx] ?? null,
          low: lows[idx] ?? null,
          close: closes[idx] ?? null,
          volume: volumes[idx] ?? null,
          fetched_at: nowIso,
          source: 'yahoo',
        }))

        const { error: snapErr } = await supabase
          .from('market_futures_snapshots')
          .upsert(snapshotRows as never, { onConflict: 'ticker,interval,point_time' })
        if (snapErr) throw new Error(`Failed upserting futures snapshots: ${snapErr.message}`)
        rowsWritten += snapshotRows.length
      }
    }

    const finishedAt = new Date().toISOString()
    await supabase
      .from('market_sync_runs')
      .update({
        status: 'success',
        finished_at: finishedAt,
        rows_written: rowsWritten,
        meta: {
          location: 'buhler',
          adm_rows: admRows.length,
          ...(admErrors.length > 0 ? { adm_errors: admErrors } : {}),
        },
      } as never)
      .eq('id', runId)

    return { runId, rowsWritten, finishedAt }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    await supabase
      .from('market_sync_runs')
      .update({
        status: 'error',
        finished_at: finishedAt,
        rows_written: rowsWritten,
        error_text: error instanceof Error ? error.message : String(error),
      } as never)
      .eq('id', runId)
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await runIngest()
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
