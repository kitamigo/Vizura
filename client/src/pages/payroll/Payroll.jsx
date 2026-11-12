import EmployerPayroll from '../../pages/payroll/EmployerPayroll'

function Payroll() {
  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="flex flex-col gap-4 border-y border-sky-200/70 bg-white/85 px-4 pb-5 pt-0 backdrop-blur-md dark:border-white/15 dark:bg-slate-900/35 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-2xl font-semibold uppercase tracking-[0.05em] text-sky-700 dark:text-sky-200/90">
              Payroll
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
              Review and manage employee pay.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 dark:border-white/15 dark:bg-white/10 dark:text-sky-50">
              Test period · 1 employee
            </span>
            <button
              type="button"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-400"
            >
              Generate payslip
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Gross pay', '$1,200.00', 'Test data'],
            ['Total deductions', '$180.00', 'Test data'],
            ['Employer contributions', '$84.00', 'Test data'],
            ['Net distribution', '$1,020.00', 'Test data'],
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
                <button className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-800 transition hover:bg-sky-50 dark:border-white/15 dark:text-sky-100 dark:hover:bg-white/10">
                  Search employees
                </button>
                <button className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-400">
                  Process period
                </button>
              </div>
            </div>
            <EmployerPayroll />
          </div>

          <aside className="rounded-2xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent payroll runs</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">Successfully executed pay periods.</p>
            <div className="mt-4 space-y-2">
              {[
                ['Test period', '$1,200.00', '1 test employee'],
              ].map(([period, amount, employees]) => (
                <div key={period} className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 dark:border-white/10 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{period}</p>
                    <span className="text-xs font-semibold text-sky-700 dark:text-sky-200">{amount}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{employees} · Completed</p>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:border-white/15 dark:text-sky-200 dark:hover:bg-white/10">
              View all historical runs
            </button>
          </aside>
        </section>
      </div>

    </div>
  )
}

export default Payroll