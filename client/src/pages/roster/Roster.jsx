import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ScheduleComponent,
  Inject,
  TimelineViews,
  TimelineMonth,
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

const hoursBetween = (start, end) => (end - start) / 36e5
const currencyFormatter = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })
const shortDateFormatter = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' })
const dateFormatter = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
const defaultPeriods = [
  { id: 'morning', label: 'Morning', start: '06:00', end: '11:59' },
  { id: 'afternoon', label: 'Afternoon', start: '12:00', end: '17:59' },
  { id: 'night', label: 'Night', start: '18:00', end: '23:59' },
]

const readPeriods = () => {
  try {
    const periods = JSON.parse(localStorage.getItem('vizura-roster-day-periods') || 'null')
    return Array.isArray(periods) && periods.length === 3 ? periods : defaultPeriods
  } catch {
    return defaultPeriods
  }
}

const dateValue = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

export default function Rostering() {
  const scheduler = useRef(null)
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [sections, setSections] = useState([])
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vizura-roster-templates') || '[]') }
    catch { return [] }
  })
  const [range, setRange] = useState(() => {
    const start = mondayOf(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return { start, end }
  })
  const [shifts, setShifts] = useState(readDemoShifts)
  const [isDayView, setIsDayView] = useState(false)
  const [scheduleView, setScheduleView] = useState('week')
  const [dayViewDate, setDayViewDate] = useState(new Date())
  const [dayPeriods, setDayPeriods] = useState(readPeriods)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [selectedShift, setSelectedShift] = useState(null)
  const [pendingEmployeeShift, setPendingEmployeeShift] = useState(null)
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false)
  const [shiftFormError, setShiftFormError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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
  useEffect(() => localStorage.setItem('vizura-roster-day-periods', JSON.stringify(dayPeriods)), [dayPeriods])
  useEffect(() => localStorage.setItem('vizura-roster-templates', JSON.stringify(templates)), [templates])
  useEffect(() => scheduler.current?.refresh(), [shifts, employees, selectedEmployeeId])

  const hoursByEmployee = useMemo(() => {
    const totals = {}
    shifts.forEach((shift) => {
      if (shift.StartTime >= range.start && shift.StartTime <= range.end) {
        totals[shift.EmployeeId] = (totals[shift.EmployeeId] ?? 0) + hoursBetween(shift.StartTime, shift.EndTime)
      }
    })
    return totals
  }, [range, shifts])

  const visibleEmployees = employees
  const totalHours = Object.values(hoursByEmployee).reduce((total, hours) => total + hours, 0)
  const hasDrafts = shifts.some((shift) => !shift.IsPublished)
  const rangeLabel = `${shortDateFormatter.format(range.start)} - ${dateFormatter.format(range.end)}`
  const labourCost = shifts.reduce((total, shift) => {
    const employee = employees.find((record) => record.id === shift.EmployeeId)
    return total + hoursBetween(shift.StartTime, shift.EndTime) * (employee?.hourlyRate || 0)
  }, 0)
  const userPosition = String(user?.position || user?.role || '').toLowerCase()
  const isAdmin = !user || ['admin', 'administrator', 'owner', 'manager'].includes(userPosition)

  const openDayView = (date) => {
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)
    setDayViewDate(selected)
    setScheduleView('day')
    setRange({
      start: mondayOf(selected),
      end: new Date(mondayOf(selected).setDate(mondayOf(selected).getDate() + 6)),
    })
    setIsDayView(true)
  }

  const openScheduleView = (view) => {
    if (view === 'day') {
      openDayView(dayViewDate)
      return
    }

    setIsDayView(false)
    setScheduleView(view)
    scheduler.current?.changeView(view === 'month' ? 'TimelineMonth' : 'TimelineWeek')
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

  const closeShiftForm = () => {
    setIsShiftFormOpen(false)
    setShiftFormError('')
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
        EmployeeId: shiftForm.employeeId ? Number(shiftForm.employeeId) : null,
        RosterId: 1,
        IsPublished: false,
      })
    }
    if (shiftForm.templateName.trim()) {
      setTemplates((current) => [...current, {
        id: Date.now(),
        name: shiftForm.templateName.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        section: shiftForm.section,
      }])
    }
    setShifts((current) => [...current, ...additions])
    closeShiftForm()
  }

  const publishWeek = () => {
    if (!shifts.length) {
      setError('Add at least one shift before publishing.')
      return
    }
    if (shifts.some((shift) => !shift.EmployeeId) && !window.confirm('Some shifts do not have an employee assigned. Publish anyway?')) return
    setBusy(true)
    setShifts((current) => current.map((shift) => ({ ...shift, IsPublished: true })))
    setBusy(false)
  }

  const onEmployeeDragStart = (event, employeeId) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/vizura-employee', String(employeeId))
  }

  const onCalendarDrop = (event) => {
    event.preventDefault()
    const employeeId = Number(event.dataTransfer.getData('application/vizura-employee'))
    if (!employeeId) return
    const appointment = event.target.closest?.('[data-roster-shift-id]')
    if (appointment) {
      const shiftId = Number(appointment.dataset.rosterShiftId)
      setShifts((current) => current.map((shift) => shift.Id === shiftId ? { ...shift, EmployeeId: employeeId } : shift))
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
    const employeeId = Number(event.dataTransfer.getData('application/vizura-employee'))
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

  const eventTemplate = (props) => {
    const employee = employees.find((record) => record.id === props.EmployeeId)
    return (
      <div className="roster-event-template px-1 text-xs leading-tight">
        {props.Section && <strong className="block truncate">{props.Section}</strong>}
        {employee?.name
          ? <strong className="block truncate">{employee.name}</strong>
          : <strong className="roster-assign-label">Assign employee</strong>}
        <span>{props.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {props.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
      </div>
    )
  }

  const onEventRendered = (args) => {
    args.element.dataset.rosterShiftId = String(args.data.Id)
    const unallocated = !args.data.EmployeeId
    const isSelectedEmployee = selectedEmployeeId !== null && args.data.EmployeeId === selectedEmployeeId
    args.element.classList.toggle('roster-selected-schedule-shift', isSelectedEmployee)
    args.element.style.backgroundColor = unallocated ? '#fef3c7' : (args.data.IsPublished ? '#2563eb' : '#dbeafe')
    args.element.style.color = unallocated ? '#92400e' : (args.data.IsPublished ? '#fff' : '#1e3a8a')
    args.element.style.border = isSelectedEmployee
      ? '3px solid #f59e0b'
      : (unallocated ? '1px dashed #d97706' : (args.data.IsPublished ? 'none' : '1px dashed #2563eb'))
    args.element.style.boxShadow = isSelectedEmployee ? '0 0 0 3px rgb(245 158 11 / 30%)' : ''
  }

  const loadTemplate = (templateId) => {
    const template = templates.find((record) => record.id === Number(templateId))
    if (template) setShiftForm((current) => ({ ...current, startTime: template.startTime, endTime: template.endTime, section: template.section }))
  }

  const updatePeriod = (periodId, field, value) => {
    setDayPeriods((current) => current.map((period) => period.id === periodId ? { ...period, [field]: value } : period))
  }

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
            className="overflow-hidden rounded-xl border border-sky-200/80 bg-white/80"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onCalendarDrop}
          >
            <div className="roster-calendar-header">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Shift schedule</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose Day, Week or Month view.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="roster-view-switcher" aria-label="Roster view">
                  <button type="button" onClick={() => openScheduleView('day')} className={scheduleView === 'day' ? 'is-active' : ''}>Day</button>
                  <button type="button" onClick={() => openScheduleView('week')} className={scheduleView === 'week' ? 'is-active' : ''}>Week</button>
                  <button type="button" onClick={() => openScheduleView('month')} className={scheduleView === 'month' ? 'is-active' : ''}>Month</button>
                </div>
                {isAdmin && <button type="button" onClick={openShiftForm} className="roster-secondary-button">Add shift</button>}
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
                  onOpenShift={(shiftId) => setSelectedShift(shifts.find((shift) => shift.Id === shiftId) || null)}
                />
              ) : (
                <ScheduleComponent
                  ref={scheduler}
                  className="roster-schedule"
                  height="600px"
                  width="100%"
                  currentView={scheduleView === 'month' ? 'TimelineMonth' : 'TimelineWeek'}
                  selectedDate={range.start}
                  firstDayOfWeek={1}
                  timeScale={{ enable: false }}
                  showQuickInfo={false}
                  showHeaderBar={false}
                  rowAutoHeight
                  allowDragAndDrop
                  allowResizing
                  dateHeaderTemplate={(props) => (
                    <button type="button" className="roster-date-header" onClick={() => openDayView(props.date)}>
                      {new Date(props.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </button>
                  )}
                  eventSettings={{
                    dataSource: shifts,
                    template: eventTemplate,
                    fields: { id: 'Id', subject: { name: 'Subject', default: 'Shift' }, startTime: { name: 'StartTime' }, endTime: { name: 'EndTime' } },
                  }}
                  eventRendered={onEventRendered}
                  actionComplete={(args) => {
                    if (args.requestType === 'dateNavigate' || args.requestType === 'viewNavigate') {
                      const dates = scheduler.current?.getCurrentViewDates() || []
                      if (dates.length) setRange({ start: dates[0], end: dates[dates.length - 1] })
                    }
                  }}
                  actionBegin={(args) => {
                    if (args.requestType === 'eventSelect') setSelectedShift(args.data)
                  }}
                >
                  <Inject services={[TimelineViews, TimelineMonth, DragAndDrop, Resize]} />
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
        templates={templates}
        onLoadTemplate={loadTemplate}
        error={shiftFormError}
        onChange={updateShiftForm}
        onClose={closeShiftForm}
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
      />
    </div>
  )
}
