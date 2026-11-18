import { useEffect, useMemo, useState } from 'react'
import {
  fetchAnomalies,
  fetchNlqHistory,
  fetchRevenueTrend,
  fetchSavedForecast,
  fetchUploadedCsvs,
  activateUploadedCsv,
  saveAnalyticsEvent,
  deleteUploadedCsv,
  runForecast,
  runNlqQuery,
  uploadAnalyticsCsv,
} from '../../services/analyticsApi'

const toDateString = (date) => (date ? date.toISOString().split('T')[0] : null)

export function getDateRangePayload(dateRange) {
  return {
    startDate: toDateString(dateRange.startDate),
    endDate: toDateString(dateRange.endDate),
  }
}

// first server message found in `keys`
function getApiError(error, fallback, keys = ['message', 'error']) {
  const data = error?.response?.data
  for (const key of keys) {
    if (data?.[key]) return data[key]
  }
  return fallback
}

function zipForecastPoints(forecast) {
  if (!Array.isArray(forecast?.dates)) return []

  return forecast.dates.map((date, i) => ({
    date,
    predicted_revenue: forecast.ensemble_forecast?.[i] ?? forecast.xgboost_forecast?.[i] ?? 0,
    yhat_lower: forecast.lower_bound?.[i] ?? 0,
    yhat_upper: forecast.upper_bound?.[i] ?? 0,
  }))
}

function normalizeAnomalyItems(items) {
  if (!Array.isArray(items)) return []

  return items.map((a) => ({
    date: a.date,
    type: a.method || a.explanation?.split(':')[0] || 'unknown',
    severity: a.severity || 'warning',
    value: a.value,
    expected_value: a.expected_value,
    deviation_pct: a.deviation_pct,
    explanation: a.explanation,
    holiday_name: a.holiday_name || null,
  }))
}

function normalizeAnalyticsPayload(payload) {
  const rawForecast = payload?.forecast
  const rawAnomalies = payload?.anomalies

  return {
    forecast: Array.isArray(rawForecast)
      ? rawForecast.map((point, index) => ({
          date: point.date || point.ds || null,
          predicted_revenue: point.predicted_revenue ?? point.ensemble_forecast ?? point.yhat ?? 0,
          yhat_lower: point.yhat_lower ?? point.lower_bound ?? 0,
          yhat_upper: point.yhat_upper ?? point.upper_bound ?? 0,
        }))
      : zipForecastPoints(rawForecast),
    // accepts { anomalies: [...] } or a bare array
    anomalies: normalizeAnomalyItems(
      Array.isArray(rawAnomalies) ? rawAnomalies : rawAnomalies?.anomalies,
    ),
    fileName: payload?.fileName || null,
    uploadedAt: payload?.uploadedAt || null,
  }
}

function normalizeNlqResult(payload) {
  return {
    question: payload?.question || '',
    sql: payload?.sql || '',
    confidence: typeof payload?.confidence === 'number' ? payload.confidence : 0,
    method: payload?.method || 'rule_based',
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
    row_count: typeof payload?.row_count === 'number' ? payload.row_count : 0,
  }
}

// runs `load` when deps change, ignoring stale results
function useLoadEffect(load, onSuccess, onError, deps) {
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await load()
        if (!cancelled) onSuccess(res)
      } catch {
        if (!cancelled) onError()
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// -- Hooks -- //
export function useAnalyticsData(dateRange) {
  const [forecastPts, setForecastPts] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [csvFile, setCsvFile] = useState(null)
  const [loadingForecast, setLoadingForecast] = useState(false)
  const [loadingAnomalies, setLoadingAnomalies] = useState(false)
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [loadingQuery, setLoadingQuery] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [queryResult, setQueryResult] = useState(null)
  const [queryHistory, setQueryHistory] = useState([])
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [revenueTrendPts, setRevenueTrendPts] = useState([])
  const [uploadedCsvs, setUploadedCsvs] = useState([])
  const [activatingCsvId, setActivatingCsvId] = useState(null)
  const [customEvents, setCustomEvents] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)

  const hasData = forecastPts.length > 0 || anomalies.length > 0

  const queryCols = useMemo(
    () => (queryResult?.rows?.length ? Object.keys(queryResult.rows[0]) : []),
    [queryResult],
  )

  // -- Initial loads -- //
  useLoadEffect(
    fetchUploadedCsvs,
    (res) => {
      const uploads = Array.isArray(res?.uploads) ? res.uploads : []
      setUploadedCsvs(uploads)
      setCustomEvents(uploads.find((u) => u.isActive)?.customEvents || [])
    },
    () => setUploadedCsvs([]),
    [],
  )

  useLoadEffect(
    fetchSavedForecast,
    (res) => {
      const norm = normalizeAnalyticsPayload(res)
      setForecastPts(norm.forecast)
      setAnomalies(norm.anomalies)
      setUploadedFileName(norm.fileName || '')
    },
    () => {
      setForecastPts([])
      setAnomalies([])
    },
    [],
  )

  useLoadEffect(
    fetchNlqHistory,
    (res) => setQueryHistory(Array.isArray(res?.history) ? res.history : []),
    () => setQueryHistory([]),
    [],
  )

  useLoadEffect(
    () => fetchRevenueTrend(getDateRangePayload(dateRange)),
    (res) => setRevenueTrendPts(res?.points || []),
    () => setRevenueTrendPts([]),
    [dateRange],
  )

  // -- shared actions -- //
  const startAction = () => {
    setStatusMsg('')
    setErrorMsg('')
  }

  const applyAnalytics = (norm) => {
    setForecastPts(norm.forecast)
    setAnomalies(norm.anomalies)
  }

  // failures are ignored so callers still succeed
  const refreshRevenueTrend = async () => {
    try {
      const res = await fetchRevenueTrend(getDateRangePayload(dateRange))
      setRevenueTrendPts(res?.points || [])
    } catch {
      // ignore
    }
  }

  // -- Analytics actions -- //
  const runSavedForecast = async () => {
    if (!hasData) {
      setErrorMsg('Upload a CSV first so the model has data to forecast.')
      return
    }

    setLoadingForecast(true)
    startAction()

    try {
      const norm = normalizeAnalyticsPayload(await runForecast(getDateRangePayload(dateRange)))
      setForecastPts(norm.forecast)
      if (norm.anomalies.length) setAnomalies(norm.anomalies)
      setStatusMsg('Forecast updated from the model output.')
    } catch (error) {
      setErrorMsg(getApiError(error, 'Forecast endpoint is not ready yet or returned no data.'))
    } finally {
      setLoadingForecast(false)
    }
  }

  const refreshAnomalies = async () => {
    if (!hasData) {
      setErrorMsg('Upload a CSV first')
      return
    }

    setLoadingAnomalies(true)
    startAction()

    try {
      const norm = normalizeAnalyticsPayload(await fetchAnomalies(getDateRangePayload(dateRange)))
      setAnomalies(norm.anomalies)
      if (norm.forecast.length) setForecastPts(norm.forecast)
      setStatusMsg('Anomalies refreshed from the model output.')
    } catch (error) {
      setErrorMsg(getApiError(error, 'Anomaly endpoint is not ready yet or returned no data.'))
    } finally {
      setLoadingAnomalies(false)
    }
  }

  const uploadCsv = async (file) => {
    if (!file) {
      setErrorMsg('Choose a CSV file first.')
      return
    }

    const normalizedName = file.name.trim().toLowerCase()
    const duplicate = uploadedCsvs.find((upload) =>
      String(upload.fileName || '').trim().toLowerCase() === normalizedName,
    )
    if (duplicate) {
      setErrorMsg(`A CSV named "${file.name}" has already been uploaded. Select the existing saved CSV instead.`)
      return
    }

    setLoadingUpload(true)
    startAction()

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadAnalyticsCsv(fd)
      const norm = normalizeAnalyticsPayload(res)

      applyAnalytics(norm)
      setUploadedFileName(norm.fileName || file.name)
      setStatusMsg(res.message || 'CSV uploaded successfully. Model output received.')
      setCsvFile(null)
      window.dispatchEvent(new Event('vizura-analytics-changed'))

      // upload still succeeds if these refreshes fail
      try {
        const uploadsRes = await fetchUploadedCsvs()
        setUploadedCsvs(Array.isArray(uploadsRes?.uploads) ? uploadsRes.uploads : [])
      } catch {
        // ignore
      }
      await refreshRevenueTrend()
    } catch (error) {
      setErrorMsg(
        getApiError(
          error,
          'Upload failed or the model endpoint did not return analytics data.',
          ['error', 'message'],
        ),
      )
    } finally {
      setLoadingUpload(false)
    }
  }

  // -- Natural language query -- //
  const submitQuery = async (question) => {
    const q = String(question || queryText).trim()
    if (!q) {
      setErrorMsg('Ask a question first.')
      return
    }

    setLoadingQuery(true)
    startAction()

    try {
      const norm = normalizeNlqResult(await runNlqQuery({ question: q }))

      setQueryResult(norm)
      setQueryText(norm.question)
      setQueryHistory((current) =>
        [
          {
            question: norm.question,
            timestamp: new Date().toISOString(),
            row_count: norm.row_count,
            method: norm.method,
          },
          ...current.filter((item) => item.question !== norm.question),
        ].slice(0, 10),
      )
      setStatusMsg('Query executed.')
    } catch {
      setErrorMsg('NLQ endpoint is not ready yet or returned an error.')
      setQueryResult({ question: q, sql: '', confidence: 0, method: 'error', rows: [], row_count: 0 })
    } finally {
      setLoadingQuery(false)
    }
  }

  const loadHistoryQuery = (item) => {
    setQueryText(item.question)
    submitQuery(item.question)
  }

  // -- Upload management -- //
  const activateCsv = async (id) => {
    setActivatingCsvId(id)
    startAction()

    try {
      const norm = normalizeAnalyticsPayload(await activateUploadedCsv(id))

      applyAnalytics(norm)
      setUploadedFileName(norm.fileName || '')
      setUploadedCsvs((current) => current.map((u) => ({ ...u, isActive: u.id === id })))
      setStatusMsg(`${norm.fileName || 'Uploaded CSV'} activated.`)
      window.dispatchEvent(new Event('vizura-analytics-changed'))

      await refreshRevenueTrend()
    } catch (error) {
      setErrorMsg(getApiError(error, 'CSV activation failed', ['message']))
    } finally {
      setActivatingCsvId(null)
    }
  }

  const addCustomEvent = async (date, name) => {
    const trimmedName = name.trim()
    if (!date || !trimmedName) {
      setErrorMsg('Choose a date and enter an event name.')
      return
    }

    try {
      const res = await saveAnalyticsEvent(date, trimmedName)
      const events = res.events || []

      setCustomEvents(events)
      setUploadedCsvs((current) =>
        current.map((u) => (u.isActive ? { ...u, customEvents: events } : u)),
      )
      setStatusMsg(`Event added: ${trimmedName}`)
      await refreshAnomalies()
    } catch (error) {
      setErrorMsg(getApiError(error, 'Could not save the event.', ['message']))
    }
  }

  const confirmDeleteCsv = async () => {
    if (!deleteTarget) return

    try {
      await deleteUploadedCsv(deleteTarget.id)
      setUploadedCsvs((current) => current.filter((u) => u.id !== deleteTarget.id))
      setStatusMsg(`${deleteTarget.fileName} deleted.`)
      setCustomEvents([])
      window.dispatchEvent(new Event('vizura-analytics-changed'))
    } catch (error) {
      setErrorMsg(getApiError(error, 'Could not delete the CSV.', ['message']))
    } finally {
      setDeleteTarget(null)
    }
  }

  const deleteCsv = async (upload) => {
    if (!upload) return
    if (!window.confirm(`Delete "${upload.fileName}"? This cannot be undone.`)) return
    try {
      await deleteUploadedCsv(upload.id)
      setUploadedCsvs((current) => current.filter((item) => item.id !== upload.id))
      if (upload.isActive) {
        setForecastPts([])
        setAnomalies([])
        setRevenueTrendPts([])
        setUploadedFileName('')
      }
      setStatusMsg(`${upload.fileName} deleted.`)
      setCustomEvents(upload.isActive ? [] : customEvents)
      window.dispatchEvent(new Event('vizura-analytics-changed'))
    } catch (error) {
      setErrorMsg(getApiError(error, 'Could not delete the CSV.', ['message']))
    }
  }

  return {
    anomalies,
    csvFile,
    errorMsg,
    forecastPts,
    hasData,
    loadingAnomalies,
    loadingForecast,
    loadingQuery,
    loadingUpload,
    queryCols,
    queryHistory,
    queryResult,
    queryText,
    refreshAnomalies,
    runSavedForecast,
    setCsvFile,
    setErrorMsg,
    setQueryText,
    setStatusMsg,
    statusMsg,
    submitQuery,
    loadHistoryQuery,
    uploadCsv,
    revenueTrendPts,
    uploadedFileName,
    uploadedCsvs,
    activatingCsvId,
    activateCsv,
    customEvents,
    deleteTarget,
    setDeleteTarget,
    addCustomEvent,
    confirmDeleteCsv,
    deleteCsv,
  }
}
