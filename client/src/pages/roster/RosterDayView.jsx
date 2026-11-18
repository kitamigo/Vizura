const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours * 60) + minutes
}

const periodTimeOptions = Array.from({ length: 144 }, (_, index) => {
  const hours = Math.floor((index * 10) / 60)
  const minutes = (index * 10) % 60
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return {
    value,
    label: `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`,
  }
})

const formatTime = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

const formatHour = (hour) => {
  const hour12 = hour % 12 || 12
  return `${hour12} ${hour >= 12 ? 'PM' : 'AM'}`
}

const hoursInPeriod = (start, end) => {
  const first = Math.floor(timeToMinutes(start) / 60)
  const last = Math.floor(timeToMinutes(end) / 60)
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index)
}

export default function RosterDayView({
  date,
  shifts,
  employees,
  periods,
  isAdmin,
  selectedEmployeeId,
  onUpdatePeriod,
  onHourDrop,
  onShiftDragStart,
  onDeleteShift,
  onOpenShift,
}) {
  const dayShifts = shifts.filter((shift) => (
    new Date(shift.StartTime).toDateString() === date.toDateString()
  ))

  return (
    <div className="roster-day-view">
      <div className="roster-day-heading">
        <strong>{date.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <span>{dayShifts.length} shifts</span>
      </div>
      <div className="roster-day-columns">
        {periods.map((period) => (
          <div className="roster-hour-column" key={period.id}>
            <div className="roster-hour-column-title">
              <strong>{period.label}</strong>
              {isAdmin ? (
                <div className="roster-period-times">
                  <RosterDropdown
                    value={period.start}
                    aria-label={`${period.label} start`}
                    options={periodTimeOptions}
                    onChange={(value) => onUpdatePeriod(period.id, 'start', value)}
                    icon="◷"
                    className="roster-period-dropdown"
                  />
                  <span>–</span>
                  <RosterDropdown
                    value={period.end}
                    aria-label={`${period.label} end`}
                    options={periodTimeOptions}
                    onChange={(value) => onUpdatePeriod(period.id, 'end', value)}
                    icon="◷"
                    className="roster-period-dropdown"
                  />
                </div>
              ) : (
                <span>{formatTime(period.start)} - {formatTime(period.end)}</span>
              )}
            </div>
            {hoursInPeriod(period.start, period.end).map((hour) => (
              <div
                className="roster-hour-row"
                key={hour}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onHourDrop(event, hour)}
              >
                <span className="roster-hour-label">{formatHour(hour)}</span>
                <div className="roster-hour-shifts">
                  {dayShifts
                    .filter((shift) => new Date(shift.StartTime).getHours() === hour)
                    .map((shift) => {
                      const employee = employees.find((record) => record.id === shift.EmployeeId)
                      return (
                        <button
                          type="button"
                          className={`roster-hour-shift ${selectedEmployeeId !== null && shift.EmployeeId === selectedEmployeeId ? 'roster-selected-shift' : ''}`}
                          key={shift.Id}
                          onClick={() => onOpenShift(shift.Id)}
                          draggable
                          onDragStart={(event) => onShiftDragStart?.(event, shift.Id)}
                          onContextMenu={(event) => {
                            event.preventDefault()
                            onDeleteShift?.(shift.Id)
                          }}
                        >
                          {shift.Section && <strong>{shift.Section}</strong>}
                          <span>{employee?.name || 'Fill shift'}</span>
                          <small>
                            {new Date(shift.StartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
                            {new Date(shift.EndTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </small>
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
import RosterDropdown from './RosterDropdown'