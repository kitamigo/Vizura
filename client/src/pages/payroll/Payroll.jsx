import { useEffect, useState } from 'react'
import EmployerPayroll from '../../pages/payroll/EmployerPayroll'
import GeneratePayslipForm from './GeneratePayslipForm'
import { getPayRuns } from '../../services/payrollApi'

// - Payroll page - //
function Payroll() {
  const [payRuns, setPayRuns] = useState([])
  const [showGenerator, setShowGenerator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getPayRuns()
      .then((runs) => {
        if (active) setPayRuns(runs)
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || err.response?.data?.error || 'Unable to load payroll.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const latest = payRuns[0]
  const money = (value) => new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
  }).format(Number(value || 0))

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-sky-100/70">
              Review and manage employee pay.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 dark:border-white/15 dark:bg-white/10 dark:text-sky-50">
              {latest
                ? `${latest.pay_period_start} – ${latest.pay_period_end} · ${latest.employee_count} employee${latest.employee_count === 1 ? '' : 's'}`
                : 'No completed pay period'}
            </span>
            <button
              type="button"
              onClick={() => setShowGenerator(true)}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-400"
            >
              Generate payslip
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Gross pay', money(latest?.gross_pay), latest ? 'Live' : 'No data'],
            ['Total deductions', money(latest?.total_deductions), latest ? 'Live' : 'No data'],
            ['Employer contributions', money(latest?.employer_contributions), latest ? 'Live' : 'No data'],
            ['Net distribution', money(latest?.net_pay), latest ? 'Live' : 'No data'],
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
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current pay period</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-2xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none sm:p-5">
            <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current pay period</h2>
                <p className="text-xs text-slate-500 dark:text-sky-100/70">Review payroll actions before processing.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerator(true)}
                  className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-400"
                >
                  Generate payslip
                </button>
              </div>
            </div>
            {loading ? (
              <p className="py-6 text-sm text-slate-500">Loading payroll...</p>
            ) : error ? (
              <p className="py-6 text-sm text-rose-600">{error}</p>
            ) : (
              <EmployerPayroll payRun={latest} />
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
      </div>

      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setShowGenerator(false)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow">
                Close
              </button>
            </div>
            <GeneratePayslipForm />
          </div>
        </div>
      )}

    </div>
  )
}

export default Payroll