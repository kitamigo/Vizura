const { isPublicHoliday } = require('./nzHolidays')

// function to convert a date value to ISO format (YYYY-MM-DD)
function toIsoDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}
// checks if a date range is valid
function isValidDateRange(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')
    || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')
    || start > end) return false

  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return !Number.isNaN(startDate.getTime())
    && !Number.isNaN(endDate.getTime())
    && formatDate(startDate) === start
    && formatDate(endDate) === end
}

function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function safeDownloadName(value) {
  return String(value || 'employee')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'employee'
}

function normalizeEmploymentType(value) {
  return String(value || 'permanent').toLowerCase() === 'casual'
    ? 'casual'
    : 'permanent'
}
// calculates total regular hours and public holidays worked from a list of shifts
function calculateShiftHours(shifts, region = 'Canterbury', startingRegularHours = null) {
  const hasStartingTotal = startingRegularHours != null
  let regularHours = hasStartingTotal ? startingRegularHours : 0
  const publicHolidays = []

  for (const shift of Array.isArray(shifts) ? shifts : []) {
    const date = toIsoDate(shift.date)
    const hours = toFiniteNumber(shift.hours_worked ?? shift.hours) || 0
    if (!date || hours <= 0) continue

    if (isPublicHoliday(date, region)) {
      regularHours = Math.max(0, regularHours - hours)
      publicHolidays.push({
        date,
        hoursWorked: hours,
        worked: true,
        isNormalWorkDay: ![0, 6].includes(new Date(`${date}T00:00:00`).getDay()),
        usualDailyHours: hours,
      })
    } else if (!hasStartingTotal) {
      regularHours += hours
    }
  }

  return { regularHours, publicHolidays }
}

module.exports = {
  toIsoDate,
  isValidDateRange,
  toFiniteNumber,
  safeDownloadName,
  normalizeEmploymentType,
  calculateShiftHours,
}