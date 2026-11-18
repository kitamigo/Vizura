function EmployerPayroll({ payRun }) {
  const employees = payRun?.payslips || []

  // NZD currency formatter
  const money = (value) => new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
  }).format(Number(value || 0))
 
  // - Employer payroll list - //
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-sky-100 dark:border-white/10">
        <div className="grid grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.7fr] gap-3 bg-sky-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-slate-900/70 dark:text-sky-100">
          <span>Employee</span>
          <span>Hours</span>
          <span>Gross pay</span>
          <span>Status</span>
        </div>
        {employees.map((employee) => (
          <div
            key={employee.payslip_id}
            className="grid grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.7fr] items-center gap-3 border-t border-sky-100 px-3 py-3 text-xs dark:border-white/10"
          >
            <span className="truncate font-medium text-slate-800 dark:text-slate-100">{employee.employee_name}</span>
            <span className="text-slate-600 dark:text-slate-300">{employee.breakdown?.regularHours?.toFixed?.(1) ?? employee.breakdown?.regularHours ?? '—'}</span>
            <span className="font-medium text-sky-700 dark:text-sky-200">{money(employee.gross_pay)}</span>
            <span className="w-fit rounded-full px-2 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200">
              Processed
            </span>
          </div>
        ))}
        {!employees.length && (
          <p className="border-t border-sky-100 px-3 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            No employees in a pay run yet.
          </p>
        )}
      </div>

    </div>
  )
}

export default EmployerPayroll