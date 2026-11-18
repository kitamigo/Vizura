import api from './api'

// Analytics endpoints
export async function fetchSavedForecast() {
  const { data } = await api.get('/analytics/forecast')
  return data
}

export async function runForecast(params) {
  const { data } = await api.post('/analytics/forecast', params)
  return data
}

export async function fetchAnomalies(params) {
  const { data } = await api.get('/analytics/anomalies', { params })
  return data
}

export async function uploadAnalyticsCsv(formData) {
  const { data } = await api.post('/analytics/upload', formData, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

export async function fetchUploadedCsvs() {
  const { data } = await api.get('/analytics/uploads')
  return data
}

export async function activateUploadedCsv(id) {
  const { data } = await api.post(`/analytics/uploads/${id}/activate`)
  return data
}

export async function saveAnalyticsEvent(date, name) {
  const { data } = await api.post('/analytics/uploads/events', { date, name })
  return data
}

export async function deleteUploadedCsv(id) {
  const { data } = await api.delete(`/analytics/uploads/${id}`)
  return data
}

// NLQ endpoints
export async function runNlqQuery(payload) {
  const { data } = await api.post('/nlq/query', payload)
  return data
}

export async function fetchNlqHistory() {
  const { data } = await api.get('/nlq/history')
  return data
}

export async function fetchRevenueTrend(params) {
  const { data } = await api.get('/analytics/revenue-trend', { params })
  return data
}