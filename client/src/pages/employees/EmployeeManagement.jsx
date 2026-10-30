import { useState } from 'react'

const initialEmployee = {
  name: 'Alex Morgan',
  role: 'Test employee',
  email: 'alex.morgan@example.test',
  status: 'Active',
}

function EmployeeManagement() {
  const [employee, setEmployee] = useState(initialEmployee)
  const [saved, setSaved] = useState(false)

  const updateEmployee = (field) => (event) => {
    setEmployee((current) => ({ ...current, [field]: event.target.value }))
    setSaved(false)
  }

  const cardClass = 'rounded-xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none'
  const labelClass = 'text-[10px] uppercase tracking-wide text-slate-500 dark:text-sky-100/60'
  const inputClass = 'mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/15 dark:bg-slate-950/50 dark:text-white'

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="flex flex-col gap-4 border-y border-sky-200/70 bg-white/85 px-4 py-5 backdrop-blur-md dark:border-white/15 dark:bg-slate-900/35 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-3xl font-semibold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-200/90">
              Employee management
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
              Manage the current test employee profile.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Save employee
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Staff members', '1', 'Test employee'],
            ['Profile status', employee.status, 'Current record'],
            ['Hourly rate', 'Not set', 'No payroll data'],
            ['Overtime logged', 'Not set', 'No roster data'],
          ].map(([label, value, note]) => (
            <article key={label} className={cardClass}>
              <p className={labelClass}>{label}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className={cardClass}>
            <div className="border-b border-sky-100 pb-4 dark:border-white/10">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Staff directory</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">1 employee record</p>
            </div>
            <div className="mt-4 rounded-lg border border-sky-300 bg-sky-50/80 p-3 dark:border-sky-300/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{employee.name}</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200">
                  {employee.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">{employee.role}</p>
            </div>
          </aside>

          <article className={cardClass}>
            <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{employee.name}</h2>
                <p className="text-xs text-slate-500 dark:text-sky-100/70">{employee.role}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200">
                {employee.status}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Full name</span>
                <input className={inputClass} value={employee.name} onChange={updateEmployee('name')} />
              </label>
              <label>
                <span className={labelClass}>Role</span>
                <input className={inputClass} value={employee.role} onChange={updateEmployee('role')} />
              </label>
              <label className="sm:col-span-2">
                <span className={labelClass}>Email address</span>
                <input className={inputClass} type="email" value={employee.email} onChange={updateEmployee('email')} />
              </label>
            </div>

            <div className="mt-5 border-t border-sky-100 pt-4 dark:border-white/10">
              <p className={labelClass}>Employee data</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-sky-100/70">
                Hourly rate, contract details, and schedules have not been configured for this test employee.
              </p>
            </div>
          </article>
        </section>

        <section className={cardClass}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Staff active schedules & role master grid</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-sky-100 dark:border-white/10">
            <div className="grid min-w-[640px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3 bg-sky-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-slate-900/70 dark:text-sky-100">
              <span>Employee</span>
              <span>Role</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Schedule status</span>
            </div>
            <div className="grid min-w-[640px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3 border-t border-sky-100 px-3 py-3 text-xs dark:border-white/10">
              <span className="font-medium text-slate-900 dark:text-white">{employee.name}</span>
              <span className="text-slate-600 dark:text-slate-300">{employee.role}</span>
              <span className="text-slate-500 dark:text-slate-400">Not set</span>
              <span className="text-slate-500 dark:text-slate-400">Not set</span>
              <span className="text-slate-500 dark:text-slate-400">No roster data</span>
            </div>
          </div>
        </section>

        {saved && <p className="text-sm text-emerald-600 dark:text-emerald-300">Employee changes saved locally.</p>}
      </div>
    </div>
  )
}

export default EmployeeManagement
