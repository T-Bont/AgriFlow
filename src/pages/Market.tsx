import { useMemo, useState } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-basic-dist-min'
import { useMarketLocalBids } from '@/hooks/useMarketLocalBids'
import { useMarketChart, type MarketTimeframe } from '@/hooks/useMarketChart'
import './Market.css'

const Plot = createPlotlyComponent(Plotly)

const CROP_OPTIONS = [
  { label: 'Corn', ticker: 'ZC=F' },
  { label: 'Soybeans', ticker: 'ZS=F' },
  { label: 'Wheat', ticker: 'KE=F' },
] as const

const TIMEFRAMES: MarketTimeframe[] = ['1D', '5D', '1M', '3M', '6M', '1Y']
const centralFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
})
const centralAxisFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `$${value.toFixed(2)}`
}

function formatBasis(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

export default function Market() {
  const [selectedTicker, setSelectedTicker] = useState<(typeof CROP_OPTIONS)[number]['ticker']>('ZC=F')
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('1M')
  const selectedCropLabel = CROP_OPTIONS.find((opt) => opt.ticker === selectedTicker)?.label ?? 'Crop'

  const bidsQuery = useMarketLocalBids()
  const chartQuery = useMarketChart(selectedTicker, timeframe)
  const mkcRows = useMemo(
    () => (bidsQuery.data ?? []).filter((row) => row.location_slug === 'buhler'),
    [bidsQuery.data],
  )
  const admRows = useMemo(
    () => (bidsQuery.data ?? []).filter((row) => row.location_slug === 'adm-hutchinson'),
    [bidsQuery.data],
  )

  const chartX = useMemo(() => (chartQuery.data ?? []).map((row) => row.point_time), [chartQuery.data])
  const chartY = useMemo(() => (chartQuery.data ?? []).map((row) => row.close), [chartQuery.data])
  const chartCentralLabels = useMemo(
    () => (chartQuery.data ?? []).map((row) => centralFormatter.format(new Date(row.point_time))),
    [chartQuery.data],
  )
  const chartAxisLabels = useMemo(
    () => (chartQuery.data ?? []).map((row) => centralAxisFormatter.format(new Date(row.point_time))),
    [chartQuery.data],
  )
  const chartTicks = useMemo(() => {
    if (chartX.length === 0) return { tickvals: [] as string[], ticktext: [] as string[] }
    if (chartX.length <= 8) return { tickvals: chartX, ticktext: chartAxisLabels }

    const targetTickCount = 8
    const lastIndex = chartX.length - 1
    const step = Math.max(1, Math.floor(lastIndex / (targetTickCount - 1)))
    const indices: number[] = []
    for (let idx = 0; idx <= lastIndex; idx += step) {
      indices.push(idx)
    }
    if (indices[indices.length - 1] !== lastIndex) {
      indices.push(lastIndex)
    }
    return {
      tickvals: indices.map((idx) => chartX[idx]),
      ticktext: indices.map((idx) => chartAxisLabels[idx]),
    }
  }, [chartAxisLabels, chartX])
  const latestBidUpdate = useMemo(() => {
    const first = (bidsQuery.data ?? [])[0]
    if (!first?.last_updated) return null
    return new Date(first.last_updated)
  }, [bidsQuery.data])
  const isBidStale = !!latestBidUpdate && Date.now() - latestBidUpdate.getTime() > 15 * 60 * 1000

  return (
    <div className="market-page">
      <section className="market-section">
        <div className="market-section-header">
          <h2>Market</h2>
          {latestBidUpdate && (
            <p className={`market-update ${isBidStale ? 'stale' : ''}`}>
              Updated {latestBidUpdate.toLocaleTimeString()}
              {isBidStale ? ' (stale)' : ''}
            </p>
          )}
        </div>
        <h3 className="market-table-title">MKC Buhler</h3>
        <div className="market-table-wrap">
          <table className="market-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Basis Month</th>
                <th>Futures Price</th>
                <th>Basis</th>
                <th>Cash Price</th>
              </tr>
            </thead>
            <tbody>
              {mkcRows.map((row) => (
                <tr key={`${row.location_slug}-${row.crop}`}>
                  <td>{row.crop}</td>
                  <td>{row.basis_month ?? '—'}</td>
                  <td>{formatPrice(row.futures_price)}</td>
                  <td>{formatBasis(row.basis)}</td>
                  <td>{formatPrice(row.cash_price)}</td>
                </tr>
              ))}
              {!bidsQuery.isLoading && mkcRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="market-empty">
                    No MKC rows available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <h3 className="market-table-title">ADM Hutchinson</h3>
        <div className="market-table-wrap">
          <table className="market-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Basis Month</th>
                <th>Futures Price</th>
                <th>Basis</th>
                <th>Cash Price</th>
              </tr>
            </thead>
            <tbody>
              {admRows.map((row) => (
                <tr key={`${row.location_slug}-${row.crop}`}>
                  <td>{row.crop}</td>
                  <td>{row.basis_month ?? '—'}</td>
                  <td>{formatPrice(row.futures_price)}</td>
                  <td>{formatBasis(row.basis)}</td>
                  <td>{formatPrice(row.cash_price)}</td>
                </tr>
              ))}
              {!bidsQuery.isLoading && admRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="market-empty">
                    No ADM rows available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="market-section">
        <div className="market-controls">
          <label>
            Crop
            <select value={selectedTicker} onChange={(e) => setSelectedTicker(e.target.value as (typeof CROP_OPTIONS)[number]['ticker'])}>
              {CROP_OPTIONS.map((opt) => (
                <option key={opt.ticker} value={opt.ticker}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Timeframe
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as MarketTimeframe)}>
              {TIMEFRAMES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="market-chart-shell">
          <Plot
            data={[
              {
                type: 'scatter',
                mode: 'lines',
                x: chartX,
                y: chartY,
                customdata: chartCentralLabels,
                line: { color: '#2d6a4f', width: 2 },
                hovertemplate: '%{customdata}<br>$%{y:.2f}<extra></extra>',
                name: selectedCropLabel,
              },
            ]}
            layout={{
              title: { text: `${selectedCropLabel} (${selectedTicker})` },
              autosize: true,
              margin: { l: 40, r: 12, t: 42, b: 40 },
              xaxis: {
                title: { text: 'Time (CST/CDT)' },
                tickmode: 'array',
                tickvals: chartTicks.tickvals,
                ticktext: chartTicks.ticktext,
              },
              yaxis: { title: { text: 'Price ($/bu)' } },
              paper_bgcolor: 'white',
              plot_bgcolor: 'white',
              showlegend: false,
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: '100%', height: 360 }}
          />
          {chartQuery.isLoading && <p className="market-muted">Loading chart data...</p>}
          {chartQuery.error && <p className="market-muted">Chart data is unavailable right now.</p>}
        </div>
      </section>
    </div>
  )
}
