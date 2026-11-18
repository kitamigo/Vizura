import { useEffect, useMemo, useState } from 'react'
import {
  demoRosterChangedEvent,
  readDemoShifts,
} from '../../services/demoRoster'
import { fetchRevenueTrend, fetchSavedForecast } from '../../services/analyticsApi'
import { getPayRuns } from '../../services/payrollApi'
{/* EmployerDashboard */}
function EmployerDashboard() {
  const panelClass = 'rounded-xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none'
  const [shifts, setShifts] = useState(readDemoShifts)
  const [employees, setEmployees] = useState([])
  const [revenuePoints, setRevenuePoints] = useState([])
  const [forecastPoints, setForecastPoints] = useState([])
  const [latestPayRun, setLatestPayRun] = useState(null)
  {/* calculates the start of the current week */}
  const weekStart = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    return date
  }, [])

  {/* will refresh shifts when roster data changes */}
  useEffect(() => {
    const refreshShifts = () => setShifts(readDemoShifts())
    window.addEventListener(demoRosterChangedEvent, refreshShifts)
    window.addEventListener('storage', refreshShifts)
    return () => {
      window.removeEventListener(demoRosterChangedEvent, refreshShifts)
      window.removeEventListener('storage', refreshShifts)
    }
  }, [])
  useEffect(() => {
    const refreshEmployees = () => {
      try {
        setEmployees(JSON.parse(localStorage.getItem('vizura-employees') || '[]'))
      } catch {
        setEmployees([])
      }
    }
    refreshEmployees()
    window.addEventListener('storage', refreshEmployees)
    window.addEventListener('vizura-employees-changed', refreshEmployees)
    return () => {
      window.removeEventListener('storage', refreshEmployees)
      window.removeEventListener('vizura-employees-changed', refreshEmployees)
    }
  }, [])
  useEffect(() => {
    const refreshAnalytics = () => {
      fetchRevenueTrend({}).then((res) => setRevenuePoints(res?.points || [])).catch(() => setRevenuePoints([]))
      fetchSavedForecast().then((res) => {
        const forecast = res?.forecast
        if (Array.isArray(forecast)) setForecastPoints(forecast)
        else if (Array.isArray(forecast?.dates)) {
          setForecastPoints(forecast.dates.map((date, index) => ({
            date,
            predicted_revenue: forecast.ensemble_forecast?.[index] ?? 0,
          })))
        } else setForecastPoints([])
      }).catch(() => setForecastPoints([]))
    }
    refreshAnalytics()
    getPayRuns().then((runs) => setLatestPayRun(runs[0] || null)).catch(() => setLatestPayRun(null))
    window.addEventListener('vizura-analytics-changed', refreshAnalytics)
    window.addEventListener('storage', refreshAnalytics)
    return () => {
      window.removeEventListener('vizura-analytics-changed', refreshAnalytics)
      window.removeEventListener('storage', refreshAnalytics)
    }
  }, [])
  {/* formats the shift for a given day offset (0 = Monday, 6 = Sunday) */}
  const formatShift = (dayOffset, employeeId) => {
    const matching = shifts.filter((item) => {
      const shiftDate = new Date(item.StartTime)
      const difference = Math.round((shiftDate - weekStart) / (24 * 60 * 60 * 1000))
      return difference === dayOffset && String(item.EmployeeId) === String(employeeId)
    })
    if (!matching.length) return '—'
    const formatHour = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return matching.map((shift) => `${formatHour(new Date(shift.StartTime))}-${formatHour(new Date(shift.EndTime))}`).join(', ')
  }
  {/* generates the table rows for the roster table */}
  const rosterEmployees = useMemo(() => {
    const merged = new Map()
    employees.forEach((employee) => merged.set(String(employee.id), {
      id: employee.id,
      name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unnamed employee',
      role: employee.category || employee.employmentType || 'Employee',
      hourlyRate: Number(employee.hourlyRate || 0),
    }))
    shifts.forEach((shift) => {
      const key = String(shift.EmployeeId ?? '')
      if (key && !merged.has(key)) {
        merged.set(key, {
          id: shift.EmployeeId,
          name: 'Assigned employee',
          role: 'Employee',
          hourlyRate: 0,
        })
      }
    })
    return [...merged.values()]
  }, [employees, shifts])

  const tableRows = rosterEmployees.map((employee) => [
    employee.name,
    employee.role,
    ...Array.from({ length: 7 }, (_, index) => formatShift(index, employee.id)),
  ])

  const weekEnd = useMemo(() => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + 6)
    date.setHours(23, 59, 59, 999)
    return date
  }, [weekStart])
  const publishedWeekShifts = shifts.filter((shift) => {
    const date = new Date(shift.StartTime)
    return date >= weekStart && date <= weekEnd
  })
  const scheduledHours = publishedWeekShifts.reduce((total, shift) =>
    total + (new Date(shift.EndTime) - new Date(shift.StartTime)) / 36e5, 0)
  const scheduledCost = publishedWeekShifts.reduce((total, shift) => {
    const employee = employees.find((item) => String(item.id) === String(shift.EmployeeId))
    const hours = (new Date(shift.EndTime) - new Date(shift.StartTime)) / 36e5
    return total + hours * Number(employee?.hourlyRate || 0)
  }, 0)
  const latestRevenue = useMemo(() => {
    if (!revenuePoints.length) return []
    const sorted = [...revenuePoints].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const lastDate = new Date(`${sorted[sorted.length - 1].date}T00:00:00`)
    if (Number.isNaN(lastDate.getTime())) return sorted.slice(-6)
    const start = new Date(lastDate)
    start.setMonth(start.getMonth() - 5)
    start.setDate(1)

    const byMonth = new Map()
    sorted.forEach((point) => {
      const date = new Date(`${point.date}T00:00:00`)
      if (Number.isNaN(date.getTime()) || date < start || date > lastDate) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) || 0) + Number(point.revenue || 0))
    })
    return [...byMonth.entries()].map(([key, revenue]) => ({
      date: `${key}-01`,
      revenue,
    }))
  }, [revenuePoints])
  const revenueBars = latestRevenue.length
    ? latestRevenue.map((point) => Number(point.revenue || 0))
    : []
  const maxRevenue = Math.max(...revenueBars, 1)
  const dashboardForecast = forecastPoints.length
    ? [...forecastPoints].filter((point, index) => index === 0 || (index + 1) % Math.max(1, Math.ceil(forecastPoints.length / 6)) === 0).slice(0, 6)
    : []

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* Roster and payroll section */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
          <article className={panelClass}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Roster this week</h2>
                <p className="text-xs text-slate-500 dark:text-sky-100/70">{rosterEmployees.length} employees · Live scheduled shifts</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200">
                Live
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-sky-100 dark:border-white/10">
              <div className="grid min-w-[780px] grid-cols-[1.4fr_1fr_repeat(7,0.7fr)] gap-2 bg-sky-50 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-slate-900/70 dark:text-sky-100">
                <span>Employee</span>
                <span>Role</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
              {tableRows.map((row) => (
                <div key={row[0]} className="grid min-w-[780px] grid-cols-[1.4fr_1fr_repeat(7,0.7fr)] gap-2 border-t border-sky-100 px-3 py-3 text-[10px] dark:border-white/10">
                  {row.map((cell, index) => (
                    <span key={`${row[0]}-${index}`} className={index === 0 ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
              {!tableRows.length && (
                <p className="border-t border-sky-100 px-3 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Add employees to populate the live roster.
                </p>
              )}
            </div>
          </article>
          {/* Payroll panel */}
          <article className={panelClass}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Payroll this week</h2>
                <p className="text-xs text-slate-500 dark:text-sky-100/70">{scheduledHours.toFixed(1)} scheduled hours this week</p>
              </div>
              <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold text-sky-700 dark:bg-sky-300/15 dark:text-sky-200">
                On track
              </span>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Latest payroll</dt><dd className="font-semibold text-slate-900 dark:text-white">${Number(latestPayRun?.gross_pay || scheduledCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Scheduled hours</dt><dd className="font-semibold text-slate-900 dark:text-white">{scheduledHours.toFixed(1)}h</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Employees</dt><dd className="font-semibold text-slate-900 dark:text-white">{latestPayRun?.employee_count ?? employees.length}</dd></div>
              <div className="flex justify-between border-t border-sky-100 pt-3 dark:border-white/10"><dt className="text-slate-500 dark:text-slate-400">Payroll status</dt><dd className="font-semibold text-emerald-600 dark:text-emerald-300">On track</dd></div>
            </dl>
          </article>
        </section>
        {/* Charts section */}
        <section className="grid gap-4 lg:grid-cols-2">
          <article className={panelClass}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Forecast chart</h2>
            <p className="text-xs text-slate-500 dark:text-sky-100/70">Projected revenue (next 6 months)</p>
            <div className="relative mt-4 h-32 overflow-hidden rounded-lg border border-sky-100 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
              <div className="absolute inset-0 flex flex-col justify-between p-3">
                {[1, 2, 3, 4].map((line) => <span key={line} className="border-t border-sky-100 dark:border-white/10" />)}
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex h-20 items-end gap-3">
                {(dashboardForecast.length ? dashboardForecast : [{}, {}, {}, {}, {}, {}]).map((point, index) => (
                  <div key={point.date || index} className="flex-1 rounded-t-full bg-gradient-to-t from-sky-500 to-cyan-300" style={{ height: `${dashboardForecast.length ? 20 + (index * 10) : 20}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              {(dashboardForecast.length ? dashboardForecast : [{}, {}, {}, {}, {}, {}]).map((point, index) =>
                <span key={point.date || index}>{point.date ? point.date.slice(5) : `M${index + 1}`}</span>,
              )}
            </div>
            <p className="mt-3 text-right text-xs font-semibold text-sky-600 dark:text-sky-200">{forecastPoints.length ? 'Live forecast' : 'Awaiting CSV'}</p>
          </article>
          {/* Revenue chart panel */}
          <article className={panelClass}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Revenue chart</h2>
            <p className="text-xs text-slate-500 dark:text-sky-100/70">Recent uploaded revenue</p>
            <div className="relative mt-4 h-32 overflow-hidden rounded-lg border border-sky-100 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
              <div className="absolute inset-0 flex flex-col justify-between p-3">
                {[1, 2, 3, 4].map((line) => <span key={line} className="border-t border-sky-100 dark:border-white/10" />)}
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex h-20 items-end gap-4 px-2">
                {revenueBars.map((value, index) => (
                  <div key={index} className="flex-1 rounded-t bg-sky-400" style={{ height: `${Math.max(8, (value / maxRevenue) * 100)}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              {latestRevenue.map((point, index) => <span key={point.date || index}>{point.date ? point.date.slice(5) : `—${index + 1}`}</span>)}
            </div>
            <p className="mt-3 text-right text-xs font-semibold text-slate-900 dark:text-white">
              {revenueBars.length ? `$${revenueBars.reduce((sum, value) => sum + value, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Awaiting CSV'}
            </p>
          </article>
        </section>
      </div>
    </div>
  )
}

export default EmployerDashboard
