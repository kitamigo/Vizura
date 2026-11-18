export default function RosterTeam({ employees, hoursByEmployee, onDragStart, selectedEmployeeId, onSelectEmployee }) {
  return (
    <aside className="roster-sidebar">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Team</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">Drag a person onto a day.</p>
        </div>
        <span className="roster-count-badge">{employees.length}</span>
      </div>
      <div className="mt-4 space-y-2">
        {employees.map((employee) => {
          const employeeKey = String(employee.id ?? '')
          const hours = hoursByEmployee[employeeKey] ?? 0
          const status = hours > 50
            ? 'over'
            : (employee.employmentType === 'Casual' || hours >= employee.minimumHours)
              ? 'met'
              : 'under'
          return (
            <button
              key={employee.id}
              type="button"
              aria-pressed={selectedEmployeeId === employee.id}
              onClick={() => onSelectEmployee(selectedEmployeeId === employee.id ? null : employee.id)}
              draggable
              onDragStart={(event) => onDragStart(event, employee.id)}
              className={`roster-employee-card roster-employee-${status} ${selectedEmployeeId === employee.id ? 'is-selected' : ''} w-full cursor-pointer rounded-lg border p-3 text-left transition active:cursor-grabbing`}
            >
              <div className="flex items-center gap-2">
                <span className="roster-avatar" style={{ backgroundColor: employee.color }}>{employee.name.charAt(0)}</span>
                <p className="font-medium text-slate-900 dark:text-white">{employee.name}</p>
              </div>
              <p className="text-xs text-slate-600 dark:text-sky-100/70">{employee.role || 'Employee'}</p>
              <p className="mt-1 text-xs font-semibold">
                {hours.toFixed(1)}h rostered
                {employee.employmentType === 'Casual'
                  ? ' · Casual'
                  : ` · ${employee.minimumHours}h minimum`}
              </p>
            </button>
          )
        })}
        {!employees.length && (
          <p className="rounded-lg border border-dashed border-sky-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
            No employees available
          </p>
        )}
      </div>
    </aside>
  )
}
