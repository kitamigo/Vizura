const axios = require('axios')
const db = require('../config/db')

// -- Constants -- //
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'
const AI_SERVICE_TIMEOUT = Number(process.env.AI_SERVICE_TIMEOUT_MS || 60000)
const MIN_DATA_POINTS = 10
const MAX_STORED_UPLOADS = 5
const REVENUE_COLUMNS = new Set(['revenue', 'revenue_nzd', 'sales', 'amount', 'value'])
const HOLIDAY_COLUMNS = new Set(['holiday_name', 'event_name'])

const emptyForecast = () => ({ dates: [], ensemble_forecast: [], lower_bound: [], upper_bound: [] })
const emptyAnomalies = () => ({ anomalies: [], summary: '', anomalies_found: 0 })

// -- In-memory state (active upload) -- //
let latestAnalyticsSnapshot = null
let latestUpload = null
let latestCsvContent = null
let latestDataPoints = []
let latestCustomEvents = []

function setActiveUpload(row, dataPoints) {
  latestAnalyticsSnapshot = null
  latestCsvContent = row.csv_content || null
  latestUpload = { fileName: row.file_name, uploadedAt: row.uploaded_at }
  latestDataPoints = dataPoints || parseCsvToDataPoints(row.csv_content || '')
  latestCustomEvents = Array.isArray(row.custom_events) ? row.custom_events : []
}

function clearActiveUpload() {
  latestAnalyticsSnapshot = null
  latestUpload = null
  latestCsvContent = null
  latestDataPoints = []
  latestCustomEvents = []
}

function fileInfo() {
  return {
    fileName: latestUpload?.fileName || latestAnalyticsSnapshot?.fileName || null,
    uploadedAt: latestUpload?.uploadedAt || latestAnalyticsSnapshot?.uploadedAt || null,
  }
}

const toJson = (value) => (value ? JSON.stringify(value) : null)

// -- Database -- //
let tableReady = null

// runs once, retries after a failure
function ensureUploadTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS analytics_uploads (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          file_name TEXT NOT NULL,
          csv_content TEXT NOT NULL,
          forecast_snapshot JSONB,
          anomaly_snapshot JSONB,
          custom_events JSONB NOT NULL DEFAULT '[]'::jsonb,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_active BOOLEAN NOT NULL DEFAULT FALSE
        )
      `)
      await db.query(`
        ALTER TABLE analytics_uploads
        ADD COLUMN IF NOT EXISTS custom_events JSONB NOT NULL DEFAULT '[]'::jsonb
      `)
    })().catch((error) => {
      tableReady = null
      throw error
    })
  }
  return tableReady
}

ensureUploadTable().catch((error) => {
  console.error('Analytics upload table setup failed:', error.message)
})

async function loadActiveUploadFromDatabase() {
  try {
    await ensureUploadTable()
    const { rows } = await db.query(
      `SELECT file_name, csv_content, uploaded_at, forecast_snapshot, anomaly_snapshot, custom_events
       FROM analytics_uploads
       WHERE is_active = TRUE
       ORDER BY uploaded_at DESC, id DESC
       LIMIT 1`,
    )
    if (!rows.length) return

    const row = rows[0]
    setActiveUpload(row)
    latestAnalyticsSnapshot = {
      forecast: row.forecast_snapshot || emptyForecast(),
      anomalies: row.anomaly_snapshot || emptyAnomalies(),
      fileName: row.file_name,
      uploadedAt: row.uploaded_at,
    }
  } catch (error) {
    console.error('loadActiveUploadFromDatabase error:', error.message)
  }
}

loadActiveUploadFromDatabase()

async function persistUpload(fileName, csvContent, forecastSnapshot, anomalySnapshot) {
  await ensureUploadTable()
  await db.query('UPDATE analytics_uploads SET is_active = FALSE')
  await db.query(
    `INSERT INTO analytics_uploads
      (file_name, csv_content, forecast_snapshot, anomaly_snapshot, is_active)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [fileName, csvContent, toJson(forecastSnapshot), toJson(anomalySnapshot)],
  )
  await db.query(
    `DELETE FROM analytics_uploads
     WHERE id IN (
       SELECT id FROM analytics_uploads
       ORDER BY uploaded_at DESC, id DESC
       OFFSET ${MAX_STORED_UPLOADS}
     )`,
  )
}

function getLatestCsvContent() {
  return latestCsvContent
}

function getLatestDataPoints() {
  return latestDataPoints
}

// -- Csv helpers -- //

// splits csv into clean headers and rows
function parseCsv(csvString) {
  const [headerLine, ...rows] = csvString.trim().split('\n')
  const headers = headerLine.replace(/^﻿/, '').toLowerCase().split(',').map((h) => h.trim())
  return { headers, rows: rows.map((line) => line.split(',')) }
}

// csv to { date, revenue } points
function parseCsvToDataPoints(csvString) {
  const { headers, rows } = parseCsv(csvString)
  const dateIdx = headers.indexOf('date')
  const revIdx = headers.findIndex((h) => REVENUE_COLUMNS.has(h))
  if (dateIdx === -1 || revIdx === -1) return []

  const points = []
  for (const cols of rows) {
    const date = cols[dateIdx]?.trim()
    const revenue = parseFloat(cols[revIdx])
    if (date && !Number.isNaN(revenue)) points.push({ date, revenue })
  }
  return points
}

function getHolidayMap(csvContent) {
  if (!csvContent) return {}
  const { headers, rows } = parseCsv(csvContent)
  const dateIdx = headers.indexOf('date')
  const holidayIdx = headers.findIndex((h) => HOLIDAY_COLUMNS.has(h))
  if (dateIdx === -1 || holidayIdx === -1) return {}

  const map = {}
  for (const cols of rows) {
    const date = cols[dateIdx]?.trim()
    const holiday = cols[holidayIdx]?.trim()
    if (date && holiday) map[date] = holiday
  }
  return map
}

// -- Event helpers -- //
function getPeriodEvent(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  const month = date.getMonth() + 1
  const day = date.getDate()

  if (month === 12 && day >= 20) return 'Christmas period'
  if (month === 1 && day <= 7) return 'New Year period'
  if (month === 2 && day === 6) return 'Waitangi Day'
  if (month === 4 && day === 25) return 'ANZAC Day'
  return null
}

function mergeCustomEvents(anomalyResult) {
  if (!anomalyResult?.anomalies) return anomalyResult

  const customByDate = new Map(latestCustomEvents.map((event) => [event.date, event.name]))
  return {
    ...anomalyResult,
    anomalies: anomalyResult.anomalies.map((anomaly) => ({
      ...anomaly,
      holiday_name: customByDate.get(anomaly.date) || getPeriodEvent(anomaly.date) || '',
    })),
  }
}

// keeps points within the optional start/end dates
function filterByDateRange(points, { startDate, endDate } = {}) {
  if (!startDate && !endDate) return points
  return points.filter(
    (pt) => (!startDate || pt.date >= startDate) && (!endDate || pt.date <= endDate),
  )
}

function insufficientDataResponse(res, found) {
  return res.status(400).json({
    error: `Insufficient data points in the selected date range. At least ${MIN_DATA_POINTS} are required.`,
    found,
  })
}

// -- ai service -- //
function aiHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = process.env.AI_SERVICE_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function normalizeForecast(payload) {
  const src = payload?.data || payload || {}
  return {
    dates: src.dates || [],
    ensemble_forecast: src.ensemble_forecast || [],
    lower_bound: src.lower_bound || [],
    upper_bound: src.upper_bound || [],
    weights: { xgboost: src.xgb_weight ?? null, prophet: src.prophet_weight ?? null },
    rmse: { xgboost: src.rmse_xgb ?? null, prophet: src.rmse_prophet ?? null },
  }
}

function normalizeAnomalies(payload) {
  const src = payload?.data || payload || {}
  return {
    total_points: src.total_points || 0,
    anomalies_found: src.anomalies_found || 0,
    anomaly_rate: src.anomaly_rate || 0,
    summary: src.summary || '',
    anomalies: (src.anomalies || []).map((a) => ({
      date: a.date,
      value: a.value,
      expected_value: a.expected_value,
      deviation_pct: a.deviation_pct,
      severity: a.severity,
      method: a.method,
      explanation: a.explanation,
    })),
  }
}

async function postToAiService(path, body, normalize) {
  const response = await axios.post(`${AI_SERVICE_URL}${path}`, body, {
    headers: aiHeaders(),
    timeout: AI_SERVICE_TIMEOUT,
  })
  return normalize(response.data)
}

const callForecastService = (dataPoints) =>
  postToAiService('/forecast/predict', { data: dataPoints, days: 30 }, normalizeForecast)

const callAnomalyService = (dataPoints) =>
  postToAiService('/anomaly/detect', { data: dataPoints }, normalizeAnomalies)

// runs both calls in parallel, failures become null
function runAnalytics(dataPoints, label) {
  const safely = (promise, name) =>
    promise.catch((err) => {
      if (label) console.error(`${name} service error:`, err.message)
      return null
    })
  return Promise.all([
    safely(callForecastService(dataPoints), 'forecast'),
    safely(callAnomalyService(dataPoints), 'anomaly'),
  ])
}

// -- analytics endpoints -- //
async function getSavedForecast(req, res) {
  if (!latestAnalyticsSnapshot) await loadActiveUploadFromDatabase()

  if (!latestAnalyticsSnapshot) {
    return res.status(404).json({ message: 'Upload a CSV file to generate analytics.' })
  }

  res.json({ ...latestAnalyticsSnapshot, ...fileInfo() })
}

async function runForecast(req, res) {
  if (!latestDataPoints.length) {
    return res.status(404).json({ message: 'Upload a CSV file before running a forecast.' })
  }

  const dataPoints = filterByDateRange(latestDataPoints, req.body)
  if (dataPoints.length < MIN_DATA_POINTS) return insufficientDataResponse(res, dataPoints.length)

  try {
    const forecast = await callForecastService(dataPoints)
    latestAnalyticsSnapshot = { ...latestAnalyticsSnapshot, forecast, ...fileInfo() }
    res.json(latestAnalyticsSnapshot)
  } catch (error) {
    console.error('runForecast error:', error.message)
    res.status(502).json({
      message: 'Forecast service failed.',
      error: error.message,
      forecast: latestAnalyticsSnapshot?.forecast || [],
      fileName: latestUpload?.fileName || null,
      uploadedAt: latestUpload?.uploadedAt || null,
    })
  }
}

async function getAnomalies(req, res) {
  if (!latestDataPoints.length) {
    return res.status(404).json({ message: 'Upload a CSV file before checking anomalies.' })
  }

  const dataPoints = filterByDateRange(latestDataPoints, req.query)
  if (dataPoints.length < MIN_DATA_POINTS) return insufficientDataResponse(res, dataPoints.length)

  try {
    const anomalyResult = await callAnomalyService(dataPoints)
    const merged = mergeCustomEvents(anomalyResult)
    const holidayMap = getHolidayMap(latestCsvContent)

    merged.anomalies = merged.anomalies.map((a) => ({
      ...a,
      holiday_name: a.holiday_name || holidayMap[a.date] || '',
    }))

    latestAnalyticsSnapshot = { ...latestAnalyticsSnapshot, anomalies: merged, ...fileInfo() }

    res.json({
      anomalies: anomalyResult,
      fileName: latestUpload?.fileName || null,
      uploadedAt: latestUpload?.uploadedAt || null,
    })
  } catch (error) {
    console.error('getAnomalies error:', error.message)
    res.status(502).json({
      message: 'Anomaly detection service failed.',
      error: error.message,
      anomalies: latestAnalyticsSnapshot?.anomalies || emptyAnomalies(),
      fileName: latestUpload?.fileName || null,
      uploadedAt: latestUpload?.uploadedAt || null,
    })
  }
}

// historical data, optionally date filtered
function getRevenueTrend(req, res) {
  if (!latestDataPoints.length) {
    return res.status(404).json({ message: 'Upload a CSV file to see the revenue trend.' })
  }
  res.json({ points: filterByDateRange(latestDataPoints, req.query) })
}

// -- Upload management -- //
async function getUploadedFiles(req, res) {
  try {
    await ensureUploadTable()
    const { rows } = await db.query(
      `SELECT id, file_name, uploaded_at, is_active, csv_content, custom_events
       FROM analytics_uploads
       ORDER BY uploaded_at DESC, id DESC
       LIMIT ${MAX_STORED_UPLOADS}`,
    )

    const uploads = rows.map((row) => {
      const points = parseCsvToDataPoints(row.csv_content)
      return {
        id: String(row.id),
        fileName: row.file_name,
        uploadedAt: row.uploaded_at,
        isActive: row.is_active,
        customEvents: Array.isArray(row.custom_events) ? row.custom_events : [],
        rowCount: points.length,
        startDate: points[0]?.date ?? null,
        endDate: points[points.length - 1]?.date ?? null,
      }
    })

    res.json({ uploads })
  } catch (error) {
    console.error('getUploadedFiles error:', error.message)
    res.status(500).json({ message: 'Could not load uploaded CSVs.', error: error.message })
  }
}

async function activateUploadedFile(req, res) {
  try {
    await ensureUploadTable()
    const { rows } = await db.query(
      `SELECT id, file_name, csv_content, uploaded_at, forecast_snapshot, anomaly_snapshot, custom_events
       FROM analytics_uploads
       WHERE id = $1`,
      [req.params.id],
    )
    if (!rows.length) {
      return res.status(404).json({ message: 'Uploaded CSV not found.' })
    }

    const row = rows[0]
    const dataPoints = parseCsvToDataPoints(row.csv_content)
    if (dataPoints.length < MIN_DATA_POINTS) {
      return res.status(400).json({ message: 'The uploaded CSV does not contain enough valid rows.' })
    }

    await db.query('UPDATE analytics_uploads SET is_active = (id = $1)', [row.id])
    setActiveUpload(row, dataPoints)

    let forecastSnapshot = row.forecast_snapshot
    let anomalySnapshot = row.anomaly_snapshot

    // backfill missing snapshots
    if (!forecastSnapshot || !anomalySnapshot) {
      ;[forecastSnapshot, anomalySnapshot] = await runAnalytics(dataPoints)
      await db.query(
        `UPDATE analytics_uploads SET forecast_snapshot = $2, anomaly_snapshot = $3 WHERE id = $1`,
        [row.id, toJson(forecastSnapshot), toJson(anomalySnapshot)],
      )
    }

    latestAnalyticsSnapshot = {
      forecast: forecastSnapshot || emptyForecast(),
      anomalies: anomalySnapshot || emptyAnomalies(),
      fileName: row.file_name,
      uploadedAt: row.uploaded_at,
    }

    res.json(latestAnalyticsSnapshot)
  } catch (error) {
    console.error('activateUploadedFile error:', error.message)
    res.status(500).json({ message: 'Could not activate uploaded CSV.', error: error.message })
  }
}

async function saveCustomEvent(req, res) {
  try {
    const date = String(req.body?.date || '').trim()
    const name = String(req.body?.name || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'A valid event date is required.' })
    }
    if (!name) {
      return res.status(400).json({ message: 'An event name is required.' })
    }

    const { rows } = await db.query(
      `SELECT id, custom_events FROM analytics_uploads
       WHERE is_active = TRUE
       ORDER BY uploaded_at DESC, id DESC
       LIMIT 1`,
    )
    if (!rows.length) {
      return res.status(404).json({ message: 'Activate an uploaded CSV first.' })
    }

    const { id, custom_events: current } = rows[0]
    const nextEvents = [
      ...(Array.isArray(current) ? current : []).filter((event) => event.date !== date),
      { date, name },
    ]

    await db.query(
      `UPDATE analytics_uploads SET custom_events = $2::jsonb WHERE id = $1`,
      [id, JSON.stringify(nextEvents)],
    )
    latestCustomEvents = nextEvents

    res.json({ events: nextEvents })
  } catch (error) {
    console.error('saveCustomEvent error:', error.message)
    res.status(500).json({ message: 'Could not save the event.', error: error.message })
  }
}

async function deleteUploadedFile(req, res) {
  try {
    const { rows } = await db.query(
      `DELETE FROM analytics_uploads WHERE id = $1 RETURNING id, is_active`,
      [req.params.id],
    )
    if (!rows.length) {
      return res.status(404).json({ message: 'Uploaded CSV not found.' })
    }

    if (rows[0].is_active) {
      clearActiveUpload()

      // activate the newest remaining upload
      const { rows: remaining } = await db.query(
        `UPDATE analytics_uploads SET is_active = TRUE
         WHERE id = (SELECT id FROM analytics_uploads ORDER BY uploaded_at DESC, id DESC LIMIT 1)
         RETURNING id`,
      )
      if (remaining.length) await loadActiveUploadFromDatabase()
    }

    res.json({ deleted: true })
  } catch (error) {
    console.error('deleteUploadedFile error:', error.message)
    res.status(500).json({ message: 'Could not delete the uploaded CSV.', error: error.message })
  }
}

// -- Csv upload -- //
async function uploadCsv(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' })
  }

  const fileName = req.file.originalname
  const uploadedAt = new Date().toISOString()
  const csvContent = req.file.buffer.toString('utf8')
  const dataPoints = parseCsvToDataPoints(csvContent)

  latestCsvContent = csvContent
  latestUpload = { fileName, uploadedAt }
  latestDataPoints = dataPoints

  if (dataPoints.length < MIN_DATA_POINTS) {
    return res.status(400).json({
      error: `CSV must contain at least ${MIN_DATA_POINTS} valid data rows with date and revenue columns.`,
      found: dataPoints.length,
    })
  }

  const persist = (forecast, anomalies) =>
    persistUpload(fileName, csvContent, forecast, anomalies).catch((error) =>
      console.error('persistUpload error:', error.message),
    )

  try {
    const [forecastResult, anomalyResult] = await runAnalytics(dataPoints, true)

    if (forecastResult || anomalyResult) {
      latestAnalyticsSnapshot = {
        forecast: forecastResult || emptyForecast(),
        anomalies: anomalyResult || emptyAnomalies(),
        fileName,
        uploadedAt,
      }
      await persist(forecastResult, anomalyResult)
      return res.status(200).json({
        message: 'CSV uploaded and analytics generated.',
        ...latestAnalyticsSnapshot,
      })
    }

    // ai service unreachable, return empty analytics
    latestAnalyticsSnapshot = {
      forecast: [],
      anomalies: [],
      fileName,
      uploadedAt,
      dataPoints: dataPoints.length,
    }
    await persist(null, null)

    return res.status(202).json({
      message: 'CSV uploaded. Start the AI service (ai-service/) to generate analytics.',
      ...latestAnalyticsSnapshot,
    })
  } catch (error) {
    console.error('analytics upload error:', error.message)
    latestAnalyticsSnapshot = { forecast: [], anomalies: [], fileName: null, uploadedAt: null }

    return res.status(502).json({
      message: 'CSV uploaded but analytics processing failed.',
      error: error.message,
      ...latestAnalyticsSnapshot,
      fileName,
      uploadedAt,
    })
  }
}

module.exports = {
  getSavedForecast,
  runForecast,
  getAnomalies,
  uploadCsv,
  getRevenueTrend,
  getUploadedFiles,
  activateUploadedFile,
  saveCustomEvent,
  deleteUploadedFile,
  getLatestCsvContent,
  getLatestDataPoints,
}