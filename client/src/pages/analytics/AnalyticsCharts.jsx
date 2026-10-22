import { useState } from 'react'
import { formatDDMMYY } from './analyticsUtils'

export function ForecastTrendChart({ data }) {
  const [selected, setSelected] = useState(null)

  if (!data.length) {
    return <div className="text-sm text-slate-500 dark:text-slate-300">Upload a CSV to see the revenue trend.</div>
  }

  const width = 640
  const height = 260
  const padding = 40
  const vals = data.map((item) => item.revenue)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const rng = max - min || 1
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0
  const scaleY = (value) => height - padding - ((value - min) / rng) * (height - padding * 2)
  const scaleX = (index) => padding + index * xStep
  const linePts = data.map((item, index) => `${scaleX(index)},${scaleY(item.revenue)}`).join(' ')

  const yTicks = getNiceTicks(min, max)

  return (
    <div className="relative">
      <div className="mb-2 h-6 text-sm font-medium text-slate-700 dark:text-slate-200">
        {selected ? `${formatDDMMYY(selected.date)} — $${selected.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Click a point to see its value'}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={padding} x2={width - padding} y1={scaleY(tick)} y2={scaleY(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padding - 8} y={scaleY(tick) + 4} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-300">
              ${Math.round(tick).toLocaleString()}
            </text>
          </g>
        ))}

        <polyline
          points={`${linePts} ${padding},${height - padding} ${width - padding},${height - padding}`}
          fill="url(#trend-fill)"
          stroke="none"
        />
        <polyline points={linePts} fill="none" stroke="#0369a1" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((item, index) => (
          <g key={item.date} className="group">
            <circle
              cx={scaleX(index)}
              cy={scaleY(item.revenue)}
              r={selected?.date === item.date ? 6 : 4}
              fill={selected?.date === item.date ? '#0369a1' : '#0f172a'}
              className="cursor-pointer dark:fill-white"
              onClick={() => setSelected(item)}
            >
              <title>{`${formatDDMMYY(item.date)}: $${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</title>
            </circle>
            {index % Math.ceil(data.length / 8) === 0 && (
              <text x={scaleX(index)} y={height - 12} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-300">
                {formatDDMMYY(item.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function niceStep(rawStep) {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  let niceResidual
  if (residual <= 1) niceResidual = 1
  else if (residual <= 2) niceResidual = 2
  else if (residual <= 5) niceResidual = 5
  else niceResidual = 10
  return niceResidual * magnitude
}

function getNiceTicks(min, max, tickCount = 4) {
  const range = max - min || 1
  const step = niceStep(range / (tickCount - 1))
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks = []
  for (let v = niceMin; v <= niceMax; v += step) {
    ticks.push(Math.round(v))
  }
  return ticks
}

export function ForecastBandChart({ data }) {
  if (!data.length) {
    return <div className="text-sm text-slate-500 dark:text-slate-300">No forecast data available.</div>
  }

  const width = 640
  const height = 260
  const padding = 44
  const vals = data.flatMap((item) => [item.yhat_lower, item.predicted_revenue, item.yhat_upper])
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const rng = max - min || 1
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0

  const scaleY = (value) => height - padding - ((value - min) / rng) * (height - padding * 2)
  const scaleX = (index) => padding + index * xStep

  const upperPts = data.map((item, index) => `${scaleX(index)},${scaleY(item.yhat_upper)}`).join(' ')
  const lowerPts = data
    .slice()
    .reverse()
    .map((item, index) => `${scaleX(data.length - 1 - index)},${scaleY(item.yhat_lower)}`)
    .join(' ')
  const linePts = data.map((item, index) => `${scaleX(index)},${scaleY(item.predicted_revenue)}`).join(' ')

const yTicks = getNiceTicks(min, max)
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
      <defs>
        <linearGradient id="forecast-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={padding} x2={width - padding} y1={scaleY(tick)} y2={scaleY(tick)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={padding - 8} y={scaleY(tick) + 4} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-300">
            ${Math.round(tick).toLocaleString()}
          </text>
        </g>
      ))}

      <polyline points={`${upperPts} ${lowerPts}`} fill="url(#forecast-band)" stroke="none" />
      <polyline points={linePts} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((item, index) => (
        <g key={item.date}>
          <circle cx={scaleX(index)} cy={scaleY(item.predicted_revenue)} r="4" fill="#0f172a" className="cursor-pointer dark:fill-white">
            <title>{`${formatDDMMYY(item.date)}: $${item.predicted_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} (range $${Math.round(item.yhat_lower).toLocaleString()}–$${Math.round(item.yhat_upper).toLocaleString()})`}</title>
          </circle>
          {index % labelEvery === 0 && (
            <text x={scaleX(index)} y={height - 12} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-300">
              {formatDDMMYY(item.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}