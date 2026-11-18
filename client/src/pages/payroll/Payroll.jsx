import { useEffect, useState } from 'react'
import EmployerPayroll from '../../pages/payroll/EmployerPayroll'
import GeneratePayslipForm from './GeneratePayslipForm'
import { getPayRuns } from '../../services/payrollApi'
import { demoRosterChangedEvent, readDemoShifts } from '../../services/demoRoster'

// - Payroll page - //
function Payroll() {
  const [payRuns, setPayRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payPeriodStart, setPayPeriodStart] = useState('')
  const [payPeriodEnd, setPayPeriodEnd] = useState('')
  const [rosterShifts, setRosterShifts] = useState(readDemoShifts)
  const [employees, setEmployees] = useState([])

  const getCurrentWeek = () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const format = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return { start: format(start), end: format(end) }
  }

  const movePayPeriod = (weeks) => {
    const start = new Date(`${payPeriodStart || getCurrentWeek().start}T00:00:00`)
    start.setDate(start.getDate() + (weeks * 7))
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const format = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    setPayPeriodStart(format(start))
    setPayPeriodEnd(format(end))
  }

  useEffect(() => {
    const current = getCurrentWeek()
    setPayPeriodStart((value) => value || current.start)
    setPayPeriodEnd((value) => value || current.end)
  }, [])

  useEffect(() => {
    const refreshRoster = () => setRosterShifts(readDemoShifts())
    const refreshEmployees = () => {
      try {
        setEmployees(JSON.parse(localStorage.getItem('vizura-employees') || '[]'))
      } catch {
        setEmployees([])
      }
    }
    refreshRoster()
    refreshEmployees()
    window.addEventListener(demoRosterChangedEvent, refreshRoster)
    window.addEventListener('storage', refreshRoster)
    window.addEventListener('vizura-employees-changed', refreshEmployees)
    return () => {
      window.removeEventListener(demoRosterChangedEvent, refreshRoster)
      window.removeEventListener('storage', refreshRoster)
      window.removeEventListener('vizura-employees-changed', refreshEmployees)
    }
  }, [])

  useEffect(() => {
    let active = true
    getPayRuns()
      .then((runs) => {
        if (active) {
          setPayRuns(runs)
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || err.response?.data?.error || 'Unable to load payroll.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const periodRuns = payRuns.filter((run) =>
    run.pay_period_start === payPeriodStart && run.pay_period_end === payPeriodEnd,
  )
  const latest = periodRuns[0] || null
  const money = (value) => new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
  }).format(Number(value || 0))

  const periodStart = payPeriodStart ? new Date(`${payPeriodStart}T00:00:00`) : null
  const periodEnd = payPeriodEnd ? new Date(`${payPeriodEnd}T23:59:59`) : null
  const publishedShifts = rosterShifts.filter((shift) => {
    if (!shift.IsPublished) return false
    if (!shift.EmployeeId) return false
    const date = new Date(shift.StartTime)
    return (!periodStart || date >= periodStart) && (!periodEnd || date <= periodEnd)
  })
  const scheduledHours = publishedShifts.reduce((total, shift) =>
    total + Math.max(0, (new Date(shift.EndTime) - new Date(shift.StartTime)) / 36e5), 0)
  const activeEmployeeIds = new Set(publishedShifts
    .map((shift) => String(shift.EmployeeId ?? ''))
    .filter(Boolean))
  const labourCost = publishedShifts.reduce((total, shift) => {
    const employee = employees.find((item) => String(item.id) === String(shift.EmployeeId))
    const hours = Math.max(0, (new Date(shift.EndTime) - new Date(shift.StartTime)) / 36e5)
    const rate = Number(employee?.hourlyRate || 0)
    return total + (hours * rate)
  }, 0)
  const grossPay = labourCost
  const employeeCount = activeEmployeeIds.size
  const rosterPayslips = [...activeEmployeeIds].map((employeeId) => {
    const employee = employees.find((item) => String(item.id) === employeeId)
    const employeeShifts = publishedShifts.filter((shift) => String(shift.EmployeeId) === employeeId)
    const hours = employeeShifts.reduce((total, shift) =>
      total + Math.max(0, (new Date(shift.EndTime) - new Date(shift.StartTime)) / 36e5), 0)
    const hourlyRate = Number(employee?.hourlyRate || 0)
    return {
      payslip_id: `roster-${employeeId}`,
      employee_name: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unnamed employee' : `Employee ${employeeId}`,
      gross_pay: hours * hourlyRate,
      breakdown: { regularHours: Number(hours.toFixed(2)) },
    }
  })

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-0 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Gross pay', money(grossPay), publishedShifts.length ? 'Live roster' : 'No roster'],
            ['Scheduled hours', `${scheduledHours.toFixed(1)}h`, publishedShifts.length ? 'Live roster' : 'No roster'],
            ['Estimated labour cost', money(labourCost), publishedShifts.length ? 'Live roster' : 'No roster'],
            ['Active employees', String(employeeCount), employeeCount ? 'Live roster' : 'No roster'],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="rounded-2xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-sky-100/70">{label}</p>
                <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-300/15 dark:text-cyan-200">
                  {note}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {payPeriodStart && payPeriodEnd ? `${payPeriodStart} – ${payPeriodEnd}` : 'Current pay period'}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none sm:p-5">
            <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current pay period</h2>
                <p className="text-xs text-slate-500 dark:text-sky-100/70">Review payroll actions before processing.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => movePayPeriod(-1)}
                  className="mt-5 rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:border-white/15 dark:text-sky-200"
                  aria-label="Previous week"
                >
                  ←
                </button>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  From
                  <input
                    type="date"
                    value={payPeriodStart}
                    onChange={(event) => setPayPeriodStart(event.target.value)}
                    className="mt-1 block rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/15 dark:bg-slate-950/50 dark:text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => movePayPeriod(1)}
                  className="mt-5 rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:border-white/15 dark:text-sky-200"
                  aria-label="Next week"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = getCurrentWeek()
                    setPayPeriodStart(current.start)
                    setPayPeriodEnd(current.end)
                  }}
                  className="mt-5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400"
                >
                  This week
                </button>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  To
                  <input
                    type="date"
                    value={payPeriodEnd}
                    min={payPeriodStart || undefined}
                    onChange={(event) => setPayPeriodEnd(event.target.value)}
                    className="mt-1 block rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/15 dark:bg-slate-950/50 dark:text-white"
                  />
                </label>
              </div>
            </div>
            {!publishedShifts.length && !loading ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800 dark:border-amber-300/20 dark:bg-amber-950/20 dark:text-amber-200">
                No published roster shifts for this pay period. Publish a roster to populate payroll totals.
              </p>
            ) : loading ? (
              <p className="py-6 text-sm text-slate-500">Loading payroll...</p>
            ) : error && !publishedShifts.length ? (
              <p className="py-6 text-sm text-rose-600">{error}</p>
            ) : (
              <EmployerPayroll payRun={latest?.payslips ? latest : { payslips: rosterPayslips }} />
            )}
          </div>

          <aside className="rounded-2xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent payroll runs</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">Successfully executed pay periods.</p>
            <div className="mt-4 space-y-2">
              {payRuns.slice(0, 5).map((run) => (
                <div key={`${run.pay_period_start}-${run.pay_period_end}`} className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 dark:border-white/10 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {run.pay_period_start} – {run.pay_period_end}
                    </p>
                    <span className="text-xs font-semibold text-sky-700 dark:text-sky-200">{money(run.gross_pay)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{run.employee_count} employee{run.employee_count === 1 ? '' : 's'} · Completed</p>
                </div>
              ))}
              {!payRuns.length && !loading && (
                <p className="text-xs text-slate-500 dark:text-slate-400">No payroll runs yet.</p>
              )}
            </div>
            <button className="mt-4 w-full rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:border-white/15 dark:text-sky-200 dark:hover:bg-white/10">
              View all historical runs
            </button>
          </aside>
        </section>

        <section>
          <GeneratePayslipForm payPeriodStart={payPeriodStart} payPeriodEnd={payPeriodEnd} />
        </section>
      </div>

    </div>
  )
}

export default Payroll