function EmployerPayroll() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-sky-100 dark:border-white/10">
        <div className="grid grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.7fr] gap-3 bg-sky-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-slate-900/70 dark:text-sky-100">
          <span>Employee</span>
          <span>Hours</span>
          <span>Gross pay</span>
          <span>Status</span>
        </div>
        {[
          ['Alex Morgan', '40.0', '$1,200.00', 'Approved'],
        ].map(([employee, hours, gross, status]) => (
          <div
            key={employee}
            className="grid grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.7fr] items-center gap-3 border-t border-sky-100 px-3 py-3 text-xs dark:border-white/10"
          >
            <span className="truncate font-medium text-slate-800 dark:text-slate-100">{employee}</span>
            <span className="text-slate-600 dark:text-slate-300">{hours}</span>
            <span className="font-medium text-sky-700 dark:text-sky-200">{gross}</span>
            <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold ${status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-300/15 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200'}`}>
              {status}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}

export default EmployerPayroll