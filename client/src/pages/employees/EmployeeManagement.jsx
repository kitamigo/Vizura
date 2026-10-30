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

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="border-y border-sky-200/70 bg-white/85 px-4 py-5 backdrop-blur-md dark:border-white/15 dark:bg-slate-900/35 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-semibold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-200/90">
            Employee management
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
            Manage the current demo employee profile.
          </p>
        </section>

        <section className="max-w-3xl rounded-2xl border border-sky-200/80 bg-white/80 p-5 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none">
          <div className="mb-5 flex items-center justify-between border-b border-sky-100 pb-4 dark:border-white/10">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{employee.name}</h2>
              <p className="text-sm text-slate-500 dark:text-sky-100/70">Demo employee record</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200">
              {employee.status}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['name', 'Full name'],
              ['role', 'Role'],
              ['email', 'Email'],
            ].map(([field, label]) => (
              <label key={field} className={field === 'email' ? 'sm:col-span-2' : ''}>
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-sky-100/70">{label}</span>
                <input
                  value={employee[field]}
                  onChange={updateEmployee(field)}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/15 dark:bg-slate-900/60 dark:text-white"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
            >
              Save changes
            </button>
            {saved && <span className="text-sm text-emerald-600 dark:text-emerald-300">Changes saved locally.</span>}
          </div>
        </section>
      </div>
    </div>
  )
}

export default EmployeeManagement
