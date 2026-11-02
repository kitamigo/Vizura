import { useState } from 'react'

function Settings() {
  const [notifications, setNotifications] = useState(true)
  const [saved, setSaved] = useState(false)

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="border-y border-sky-200/70 bg-white/85 px-4 pb-5 pt-0 backdrop-blur-md dark:border-white/15 dark:bg-slate-900/35 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-200/90">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">
            Configure your Vizura demo preferences.
          </p>
        </section>

        <section className="max-w-3xl rounded-2xl border border-sky-200/80 bg-white/80 p-5 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Preferences</h2>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/70 p-4 dark:border-white/10 dark:bg-slate-900/40">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Payroll notifications</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">Show reminders for demo payroll activity.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotifications((current) => !current)
                setSaved(false)
              }}
              className={`relative h-6 w-11 rounded-full transition ${notifications ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={notifications}
              aria-label="Toggle payroll notifications"
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${notifications ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Save settings
          </button>
          {saved && <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-300">Settings saved locally.</span>}
        </section>
      </div>
    </div>
  )
}

export default Settings
