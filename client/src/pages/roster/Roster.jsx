import { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'
import {
  ScheduleComponent,
  ViewsDirective,
  ViewDirective,
  Inject,
  TimelineViews,
  TimelineMonth,
  Day,
  Week,
  DragAndDrop,
  Resize,
} from '@syncfusion/ej2-react-schedule'
import { readDemoShifts, writeDemoShifts } from '../../services/demoRoster'
import { useAuth } from '../../context/useAuth'
import RosterDayView from './RosterDayView'
import RosterTeam from './RosterTeam'
import { AddShiftModal, DroppedShiftModal, ShiftDetailsModal } from './RosterModals'
import './Roster.css'

const mondayOf = (date) => {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7))
  return value
}

const dateValue = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

const hoursBetween = (start, end) => (end - start) / 36e5
const employeeKey = (value) => String(value ?? '')
const currencyFormatter = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

const defaultPeriods = [
  { id: 'morning', label: 'Morning', start: '06:00', end: '11:59' },
  { id: 'afternoon', label: 'Afternoon', start: '12:00', end: '17:59' },
  { id: 'night', label: 'Night', start: '18:00', end: '23:59' },
]

const readPeriods = () => {
  try {
    const value = JSON.parse(localStorage.getItem('vizura-roster-day-periods') || 'null')
    return Array.isArray(value) && value.length === 3 ? value : defaultPeriods
  } catch {
    return defaultPeriods
  }
}

export default function Rostering() {
  const scheduler = useRef(null)
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [sections, setSections] = useState([])
  const [shifts, setShifts] = useState(readDemoShifts)
  const [range, setRange] = useState(() => {
    const start = mondayOf(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  })
  const [isDayView, setIsDayView] = useState(false)
  const [dayViewDate, setDayViewDate] = useState(new Date())
  const [dayPeriods, setDayPeriods] = useState(readPeriods)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [selectedShift, setSelectedShift] = useState(null)
  const [pendingEmployeeShift, setPendingEmployeeShift] = useState(null)
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false)
  const [shiftFormError, setShiftFormError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    return () => {
      delete window.__vizuraDraggingShiftId
    }
  }, [])
  const [shiftForm, setShiftForm] = useState({
    date: dateValue(new Date()),
    startTime: '09:00',
    endTime: '17:00',
    section: '',
    repeat: 'none',
    templateName: '',
    employeeId: '',
  })

  useEffect(() => {
    const readEmployees = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('vizura-employees') || '[]')
        const categories = JSON.parse(localStorage.getItem('vizura-employee-categories') || '[]')
        setEmployees(stored.filter((employee) => employee.id).map((employee, index) => ({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`.trim() || 'Unnamed employee',
          role: employee.category || employee.employmentType || 'Employee',
          hourlyRate: Number(employee.hourlyRate || 0),
          employmentType: employee.employmentType || 'Permanent',
          minimumHours: employee.employmentType === 'Casual' ? 0 : Number(employee.minimumHours || 0),
          color: ['#2563eb', '#0891b2', '#7c3aed', '#0f766e'][index % 4],
        })))
        setSections([...new Set([...categories, ...stored.map((employee) => employee.category).filter(Boolean)])])
      } catch {
        setEmployees([])
        setSections([])
      }
    }
    readEmployees()
    window.addEventListener('storage', readEmployees)
    window.addEventListener('vizura-employees-changed', readEmployees)
    return () => {
      window.removeEventListener('storage', readEmployees)
      window.removeEventListener('vizura-employees-changed', readEmployees)
    }
  }, [])

  useEffect(() => writeDemoShifts(shifts), [shifts])
  useEffect(() => {
    const refreshScheduler = window.requestAnimationFrame(() => {
      if (typeof scheduler.current?.refreshEvents === 'function') {
        scheduler.current.refreshEvents()
      } else if (typeof scheduler.current?.dataBind === 'function') {
        scheduler.current.dataBind()
      }
    })
    return () => window.cancelAnimationFrame(refreshScheduler)
  }, [shifts])
  useEffect(() => localStorage.setItem('vizura-roster-day-periods', JSON.stringify(dayPeriods)), [dayPeriods])

  const hoursByEmployee = useMemo(() => {
    const totals = {}
    shifts.forEach((shift) => {
      const shiftDate = new Date(shift.StartTime)
      if (shiftDate >= range.start && shiftDate <= range.end) {
        const key = employeeKey(shift.EmployeeId)
        if (key) totals[key] = (totals[key] ?? 0) + hoursBetween(shift.StartTime, shift.EndTime)
      }
    })
    return totals
  }, [range, shifts])

  const visibleEmployees = employees
  const totalHours = Object.values(hoursByEmployee).reduce((total, hours) => total + hours, 0)
  const labourCost = shifts.reduce((total, shift) => {
    const shiftDate = new Date(shift.StartTime)
    if (shiftDate < range.start || shiftDate > range.end) return total
    const employee = employees.find((record) => employeeKey(record.id) === employeeKey(shift.EmployeeId))
    return total + hoursBetween(shift.StartTime, shift.EndTime) * (employee?.hourlyRate || 0)
  }, 0)
  const hasDrafts = shifts.some((shift) => !shift.IsPublished)
  const userPosition = String(user?.position || user?.role || '').toLowerCase()
  const isAdmin = !user || ['admin', 'administrator', 'owner', 'manager'].includes(userPosition)

  const openDayView = (date) => {
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)
    setDayViewDate(selected)
    setIsDayView(true)
  }

  const openShiftForm = () => {
    setShiftForm({
      date: dateValue(new Date()),
      startTime: '09:00',
      endTime: '17:00',
      section: '',
      repeat: 'none',
      templateName: '',
      employeeId: selectedEmployeeId ? String(selectedEmployeeId) : '',
    })
    setShiftFormError('')
    setIsShiftFormOpen(true)
  }

  const updateShiftForm = (field) => (event) => {
    setShiftForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const addShift = (event) => {
    event.preventDefault()
    if (!shiftForm.date || !shiftForm.startTime || !shiftForm.endTime) {
      setShiftFormError('Date, start time, and end time are required.')
      return
    }
    const start = new Date(`${shiftForm.date}T${shiftForm.startTime}:00`)
    const end = new Date(`${shiftForm.date}T${shiftForm.endTime}:00`)
    if (end <= start) {
      setShiftFormError('End time must be after start time.')
      return
    }
    const repeatCount = shiftForm.repeat === 'daily' ? 7 : shiftForm.repeat === 'weekly' ? 4 : 1
    const repeatDays = shiftForm.repeat === 'daily' ? 1 : 7
    const additions = []
    for (let index = 0; index < repeatCount; index += 1) {
      const shiftedStart = new Date(start)
      const shiftedEnd = new Date(end)
      shiftedStart.setDate(start.getDate() + index * repeatDays)
      shiftedEnd.setDate(end.getDate() + index * repeatDays)
      additions.push({
        Id: Date.now() + index,
        Subject: shiftForm.section || 'Shift',
        Section: shiftForm.section,
        StartTime: shiftedStart,
        EndTime: shiftedEnd,
        EmployeeId: shiftForm.employeeId || null,
        RosterId: 1,
        IsPublished: false,
      })
    }
    setShifts((current) => [...current, ...additions])
    setIsShiftFormOpen(false)
    setError('')
  }

  const publishWeek = () => {
    if (!shifts.length) {
      setError('Add at least one shift before publishing.')
      return
    }
    if (shifts.some((shift) => !shift.EmployeeId) && !window.confirm('Some shifts do not have an employee assigned. Publish anyway?')) return
    setBusy(true)
    setShifts((current) => current.map((shift) => {
      const shiftDate = new Date(shift.StartTime)
      return shiftDate >= range.start && shiftDate <= range.end
        ? { ...shift, IsPublished: true }
        : shift
    }))
    setBusy(false)
  }

  const onEmployeeDragStart = (event, employeeId) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/vizura-employee', String(employeeId))
    event.dataTransfer.setData('text/plain', `employee:${employeeId}`)
  }

  const onShiftDragStart = (event, shiftId) => {
    event.stopPropagation()
    window.__vizuraDraggingShiftId = Number(shiftId) || shiftId
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/vizura-shift', String(shiftId))
    event.dataTransfer.setData('text/plain', `shift:${shiftId}`)
  }

  useEffect(() => {
    const finishNativeDrag = (event) => {
      const shiftId = window.__vizuraDraggingShiftId
      if (!shiftId) return
      const target = document.elementFromPoint(event.clientX, event.clientY)
      if (target?.closest('[data-roster-trash-target]')) {
        deleteShift(shiftId, false)
      }
      delete window.__vizuraDraggingShiftId
    }
    const finishMouseDrag = (event) => {
      const shiftId = window.__vizuraDraggingShiftId
      if (!shiftId) return
      const target = document.elementFromPoint(event.clientX, event.clientY)
      if (target?.closest('[data-roster-trash-target]')) {
        deleteShift(shiftId, false)
      }
      delete window.__vizuraDraggingShiftId
    }
    window.addEventListener('dragend', finishNativeDrag)
    window.addEventListener('mouseup', finishMouseDrag)
    return () => {
      window.removeEventListener('dragend', finishNativeDrag)
      window.removeEventListener('mouseup', finishMouseDrag)
    }
  }, [shifts, employees])

  const deleteShift = (shiftId, confirmDelete = true) => {
    const shift = shifts.find((item) => employeeKey(item.Id) === employeeKey(shiftId))
    if (!shift) return
    const employee = employees.find((item) => employeeKey(item.id) === employeeKey(shift.EmployeeId))
    const shiftLabel = employee?.name
      ? `${employee.name} shift`
      : 'This shift'
    if (confirmDelete && !window.confirm(`Delete ${shiftLabel}? This cannot be undone.`)) return
    setShifts((current) => current.filter((item) => employeeKey(item.Id) !== employeeKey(shiftId)))
    setSelectedShift(null)
    setError('')
  }

  const onDeleteDrop = (event) => {
    event.preventDefault()
    const shiftId = event.dataTransfer.getData('application/vizura-shift')
      || String(event.dataTransfer.getData('text/plain')).replace(/^shift:/, '')
    if (shiftId && !String(shiftId).includes('employee')) deleteShift(shiftId, false)
    else if (window.__vizuraDraggingShiftId) deleteShift(window.__vizuraDraggingShiftId, false)
    delete window.__vizuraDraggingShiftId
  }

  const onCalendarDrop = (event) => {
    event.preventDefault()
    const employeeId = event.dataTransfer.getData('application/vizura-employee')
    if (!employeeId) return

    const appointment = event.target.closest?.('[data-roster-shift-id]')
    if (appointment) {
      const shiftId = Number(appointment.dataset.rosterShiftId)
      setShifts((current) => current.map((shift) => (
        shift.Id === shiftId ? { ...shift, EmployeeId: employeeId } : shift
      )))
      return
    }

    const cellDetails = scheduler.current?.getCellDetails(event.target)
    if (!cellDetails?.startTime) {
      setError('Drop the employee onto an available calendar time.')
      return
    }
    setPendingEmployeeShift({
      employeeId,
      date: new Date(cellDetails.startTime),
      startTime: '09:00',
      endTime: '17:00',
    })
  }

  const onDayHourDrop = (event, hour) => {
    event.preventDefault()
    const employeeId = event.dataTransfer.getData('application/vizura-employee')
    if (!employeeId) return
    setPendingEmployeeShift({
      employeeId,
      date: new Date(dayViewDate),
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: hour === 23 ? '23:59' : `${String(hour + 1).padStart(2, '0')}:00`,
    })
  }

  const updatePendingTime = (field) => (event) => {
    setPendingEmployeeShift((current) => ({ ...current, [field]: event.target.value }))
  }

  const addDroppedEmployeeShift = (event) => {
    event.preventDefault()
    if (!pendingEmployeeShift) return
    const date = dateValue(pendingEmployeeShift.date)
    const start = new Date(`${date}T${pendingEmployeeShift.startTime}:00`)
    const end = new Date(`${date}T${pendingEmployeeShift.endTime}:00`)
    if (end <= start) {
      setShiftFormError('End time must be after start time.')
      return
    }
    setShifts((current) => [...current, {
      Id: Date.now(),
      Subject: 'Shift',
      StartTime: start,
      EndTime: end,
      EmployeeId: pendingEmployeeShift.employeeId,
      RosterId: 1,
      IsPublished: false,
    }])
    setPendingEmployeeShift(null)
  }

  const updatePeriod = (periodId, field, value) => {
    setDayPeriods((current) => current.map((period) => (
      period.id === periodId ? { ...period, [field]: value } : period
    )))
  }

  const rangeLabel = `${range.start.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} - ${range.end.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="roster-page bg-transparent p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <section className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="roster-stat-card">
            <span className="roster-stat-label">Estimated labour cost</span>
            <strong>{currencyFormatter.format(labourCost)}</strong>
            <span className="roster-stat-detail">For week of {rangeLabel}</span>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">Total scheduled hours</span>
            <strong>{totalHours.toFixed(1)}h</strong>
            <span className="roster-stat-detail">Across {visibleEmployees.length} employees</span>
          </div>
        </section>
        {error && <div role="alert" className="roster-alert mb-4">{error}</div>}
        <div className="roster-content-grid">
          <div
            className="roster-calendar-panel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onCalendarDrop}
          >
            <div className="roster-calendar-header">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Shift schedule</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Click a date to open the day view. Drag a shift here to delete it.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-roster-trash-target
                  className="roster-trash-button"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDeleteDrop}
                  onClick={() => {
                    if (selectedShift) deleteShift(selectedShift.Id)
                  }}
                  disabled={!selectedShift}
                  aria-label="Delete selected or dragged shift"
                  title="Drag a shift here or select a shift and click to delete"
                >
                  <span aria-hidden="true">×</span>
                </button>
                {isDayView && (
                  <button type="button" onClick={() => setIsDayView(false)} className="roster-secondary-button">Back to week</button>
                )}
                {isAdmin && (
                  <button type="button" onClick={openShiftForm} className="roster-secondary-button">Add shift</button>
                )}
                <button type="button" onClick={publishWeek} disabled={busy || !hasDrafts} className="roster-primary-button">
                  {busy ? 'Saving...' : 'Publish roster'}
                </button>
              </div>
            </div>
            <div className="roster-calendar-scroll">
              {isDayView ? (
                <RosterDayView
                  date={dayViewDate}
                  shifts={shifts}
                  employees={employees}
                  periods={dayPeriods}
                  isAdmin={isAdmin}
                  selectedEmployeeId={selectedEmployeeId}
                  onUpdatePeriod={updatePeriod}
                  onHourDrop={onDayHourDrop}
                  onShiftDragStart={onShiftDragStart}
                  onDeleteShift={deleteShift}
                  onOpenShift={(shiftId) => setSelectedShift(shifts.find((shift) => shift.Id === shiftId) || null)}
                />
              ) : (
                <ScheduleComponent
                  ref={scheduler}
                  className="roster-schedule"
                  height="600px"
                  width="100%"
                  currentView="TimelineWeek"
                  selectedDate={range.start}
                  firstDayOfWeek={1}
                  timeScale={{ enable: false }}
                  showQuickInfo={false}
                  rowAutoHeight
                  allowDragAndDrop={false}
                  allowResizing
                  dateHeaderTemplate={(props) => (
                    <button type="button" className="roster-date-header" onClick={() => openDayView(props.date)}>
                      {new Date(props.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </button>
                  )}
                  eventSettings={{
                    dataSource: shifts,
                    template: (props) => {
                      const employee = employees.find((record) => employeeKey(record.id) === employeeKey(props.EmployeeId))
                      return (
                        <div className="roster-event-template px-1 text-xs leading-tight">
                          {props.Section && <strong className="block truncate">{props.Section}</strong>}
                          {employee?.name
                            ? <strong className="block truncate">{employee.name}</strong>
                            : <strong className="roster-assign-label">Fill shift</strong>}
                          <span>
                            {props.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
                            {props.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    },
                    fields: {
                      id: 'Id',
                      subject: { name: 'Subject', default: 'Shift' },
                      startTime: { name: 'StartTime' },
                      endTime: { name: 'EndTime' },
                    },
                  }}
                  eventRendered={(args) => {
                    args.element.dataset.rosterShiftId = String(args.data.Id)
                    args.element.draggable = true
                    args.element.onmousedown = () => {
                      window.__vizuraDraggingShiftId = args.data.Id
                    }
                    args.element.ondragstart = (event) => onShiftDragStart(event, args.data.Id)
                    const unallocated = !args.data.EmployeeId
                    args.element.style.backgroundColor = unallocated ? '#fef3c7' : (args.data.IsPublished ? '#2563eb' : '#dbeafe')
                    args.element.style.color = unallocated ? '#92400e' : (args.data.IsPublished ? '#fff' : '#1e3a8a')
                    args.element.style.border = unallocated ? '1px dashed #d97706' : (args.data.IsPublished ? 'none' : '1px dashed #2563eb')
                  }}
                  actionComplete={(args) => {
                    if (args.requestType === 'dateNavigate' || args.requestType === 'viewNavigate') {
                      const dates = scheduler.current?.getCurrentViewDates() || []
                      if (dates.length && args.requestType !== 'dateNavigate' && scheduler.current?.currentView !== 'Day') {
                        const start = new Date(dates[0])
                        start.setHours(0, 0, 0, 0)
                        const end = new Date(dates[dates.length - 1])
                        end.setHours(23, 59, 59, 999)
                        setRange({ start, end })
                      }
                      if (args.requestType === 'viewNavigate' && scheduler.current?.currentView === 'Day') {
                        openDayView(dates[0] || range.start)
                      }
                    }
                    if (['eventChanged', 'eventDrop', 'eventResize'].includes(args.requestType) && args.data) {
                      setShifts((current) => current.map((shift) =>
                        Number(shift.Id) === Number(args.data.Id) ? { ...shift, ...args.data } : shift,
                      ))
                    }
                  }}
                  actionBegin={(args) => {
                    if (args.requestType === 'eventSelect') setSelectedShift(args.data)
                  }}
                >
                  <ViewsDirective>
                    <ViewDirective option="Day" displayName="Day view" />
                    <ViewDirective option="TimelineWeek" displayName="Week view" />
                    <ViewDirective option="TimelineMonth" displayName="Month view" />
                  </ViewsDirective>
                  <Inject services={[Day, Week, TimelineViews, TimelineMonth, DragAndDrop, Resize]} />
                </ScheduleComponent>
              )}
            </div>
          </div>
          <RosterTeam
            employees={visibleEmployees}
            hoursByEmployee={hoursByEmployee}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            onDragStart={onEmployeeDragStart}
          />
        </div>
      </div>
      <AddShiftModal
        open={isShiftFormOpen}
        form={shiftForm}
        sections={sections}
        employees={visibleEmployees}
        templates={[]}
        onLoadTemplate={() => {}}
        error={shiftFormError}
        onChange={updateShiftForm}
        onClose={() => setIsShiftFormOpen(false)}
        onSubmit={addShift}
      />
      <DroppedShiftModal
        pending={pendingEmployeeShift}
        employees={employees}
        error={shiftFormError}
        onChange={updatePendingTime}
        onClose={() => setPendingEmployeeShift(null)}
        onSubmit={addDroppedEmployeeShift}
      />
      <ShiftDetailsModal
        shift={selectedShift}
        employees={employees}
        onClose={() => setSelectedShift(null)}
        onDelete={deleteShift}
      />
    </div>
  )
}
