import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScheduleComponent,
  ViewsDirective,
  ViewDirective,
  Inject,
  TimelineViews,
  TimelineMonth,
  Day,
  DragAndDrop,
  Resize,
} from '@syncfusion/ej2-react-schedule';
import {
  readDemoShifts,
  writeDemoShifts,
} from '../../services/demoRoster';
import { useAuth } from '../../context/useAuth';
import RosterDayView from './RosterDayView';
import RosterTeam from './RosterTeam';
import {
  AddShiftModal,
  DroppedShiftModal,
  ShiftDetailsModal,
} from './RosterModals';

/* Helpers */
const mondayOf = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const weekRangeOf = (d) => {
  const start = mondayOf(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const hoursBetween = (a, b) => (b - a) / 36e5;
const dateFormatter = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
});
const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
});

const defaultDayPeriods = [
  { id: 'morning', label: 'Morning', start: '06:00', end: '11:59' },
  { id: 'afternoon', label: 'Afternoon', start: '12:00', end: '17:59' },
  { id: 'night', label: 'Night', start: '18:00', end: '23:59' },
];

const readDayPeriods = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('vizura-roster-day-periods') || 'null');
    return Array.isArray(stored) && stored.length === 3 ? stored : defaultDayPeriods;
  } catch {
    return defaultDayPeriods;
  }
};

import './Roster.css';

/* Page */
export default function Rostering() {
  const scheduler = useRef(null);
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [sections, setSections] = useState([]);
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [pendingEmployeeShift, setPendingEmployeeShift] = useState(null);
  const [isDayView, setIsDayView] = useState(false);
  const [dayViewDate, setDayViewDate] = useState(() => new Date());
  const [dayPeriods, setDayPeriods] = useState(readDayPeriods);
  const [shiftFormError, setShiftFormError] = useState('');
  const [shiftForm, setShiftForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    section: '',
    employeeId: '',
    repeat: 'none',
    templateName: '',
  });
  const [range, setRange] = useState(() => {
    return weekRangeOf(new Date());
  });
  const [shifts, setShifts] = useState(readDemoShifts);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [templates, setTemplates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vizura-roster-templates') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const readEmployees = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('vizura-employees') || '[]');
        const categoryStorage = JSON.parse(localStorage.getItem('vizura-employee-categories') || '[]');
        setEmployees(stored
          .filter((employee) => employee.id)
          .map((employee, index) => ({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`.trim() || 'Unnamed employee',
            role: employee.category || employee.employmentType || 'Employee',
            hourlyRate: Number(employee.hourlyRate || 0),
            employmentType: employee.employmentType || 'Permanent',
            minimumHours: employee.employmentType === 'Casual'
              ? 0
              : Number(employee.minimumHours || 0),
            color: ['#2563eb', '#0891b2', '#7c3aed', '#0f766e'][index % 4],
          })));
        setSections([...new Set([
          ...categoryStorage,
          ...stored.map((employee) => employee.category).filter(Boolean),
        ])]);
      } catch {
        setEmployees([]);
      }
    };

    readEmployees();
    window.addEventListener('storage', readEmployees);
    window.addEventListener('vizura-employees-changed', readEmployees);
    return () => {
      window.removeEventListener('storage', readEmployees);
      window.removeEventListener('vizura-employees-changed', readEmployees);
    };
  }, []);

  useEffect(() => {
    writeDemoShifts(shifts);
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('vizura-roster-day-periods', JSON.stringify(dayPeriods));
  }, [dayPeriods]);

  useEffect(() => {
    scheduler.current?.refresh();
  }, [shifts, employees, selectedEmployeeId]);

  /* weekly hours per employee */
  const hoursByEmployee = useMemo(() => {
    const totals = {};
    shifts.forEach((s) => {
      if (!s.EmployeeId) return;
      const visibleStart = s.StartTime > range.start ? s.StartTime : range.start;
      const visibleEnd = s.EndTime < range.end ? s.EndTime : range.end;
      if (visibleEnd <= visibleStart) return;
      totals[s.EmployeeId] = (totals[s.EmployeeId] ?? 0) + hoursBetween(visibleStart, visibleEnd);
    });
    return totals;
  }, [range.end, range.start, shifts]);

  const onActionComplete = (args) => {
    const { requestType } = args;

    if (requestType === 'dateNavigate' || requestType === 'viewNavigate') {
      const dates = scheduler.current.getCurrentViewDates();
      setRange(weekRangeOf(dates[0]));
      if (scheduler.current.currentView === 'Day') openDayView(dates[0]);
      return;
    }

    if (!['eventCreated', 'eventChanged', 'eventRemoved'].includes(requestType)) return;

    setError('');
    if (requestType === 'eventCreated') {
      setShifts((current) => [...current, ...args.addedRecords]);
    }
    if (requestType === 'eventChanged') {
      const changed = args.changedRecords[0];
      if (changed?.EmployeeId && hasShiftOverlap(
        changed.EmployeeId,
        changed.StartTime,
        changed.EndTime,
        args.changedRecords.map((record) => record.Id),
      )) {
        setError('That shift overlaps another shift assigned to this employee.');
        scheduler.current?.refresh();
        return;
      }
      setShifts((current) => current.map((shift) => (
        args.changedRecords.find((changed) => changed.Id === shift.Id) || shift
      )));
    }
    if (requestType === 'eventRemoved') {
      const removedIds = new Set(args.deletedRecords.map((event) => event.Id));
      setShifts((current) => current.filter((shift) => !removedIds.has(shift.Id)));
    }
  };

  const hasShiftOverlap = (employeeId, startTime, endTime, ignoredIds = []) => (
    Boolean(employeeId) && shifts.some((shift) => (
      shift.EmployeeId === employeeId
      && !ignoredIds.includes(shift.Id)
      && startTime < shift.EndTime
      && endTime > shift.StartTime
    ))
  );

  const getDailyHours = (employeeId, date) => shifts
    .filter((shift) => (
      shift.EmployeeId === employeeId
      && shift.StartTime.toDateString() === date.toDateString()
    ))
    .reduce((total, shift) => total + hoursBetween(shift.StartTime, shift.EndTime), 0);

  const loadTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setShiftForm((current) => ({
      ...current,
      startTime: template.startTime,
      endTime: template.endTime,
      section: template.section,
      employeeId: template.employeeId,
    }));
  };

  const publishWeek = async () => {
    if (!shifts.length) {
      setError('Add at least one shift before publishing the roster.');
      return;
    }
    if (shifts.some((shift) => !shift.EmployeeId)) {
      const confirmed = window.confirm('Some shifts do not have an employee assigned. Publish anyway?');
      if (!confirmed) return;
    }
    const draftCount = shifts.filter((shift) => !shift.IsPublished).length;
    if (!window.confirm(`Publish ${draftCount} draft shift${draftCount === 1 ? '' : 's'}?`)) return;
    setError('');
    setBusy(true);
    setShifts((current) => current.map((shift) => ({ ...shift, IsPublished: true })));
    setBusy(false);
  };

  const openShiftForm = (selectedDate, selectedTime) => {
    const date = selectedDate instanceof Date ? new Date(selectedDate) : new Date();
    const dateValue = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const startTime = selectedTime instanceof Date
      ? `${String(selectedTime.getHours()).padStart(2, '0')}:00`
      : '09:00';
    const endTime = selectedTime instanceof Date
      ? `${String(selectedTime.getHours() === 23 ? 23 : selectedTime.getHours() + 1).padStart(2, '0')}:${selectedTime.getHours() === 23 ? '59' : '00'}`
      : '17:00';
    setShiftForm({
      date: dateValue,
      startTime,
      endTime,
      section: sections[0] || '',
      employeeId: '',
      repeat: 'none',
    });
    setShiftFormError('');
    setIsShiftFormOpen(true);
  };

  const closeShiftForm = () => {
    setIsShiftFormOpen(false);
    setShiftFormError('');
  };

  const openShiftDetails = (shiftId) => {
    const shift = shifts.find((record) => record.Id === shiftId);
    if (shift) setSelectedShift(shift);
  };

  const closeShiftDetails = () => setSelectedShift(null);

  const updatePendingTime = (field) => (event) => {
    setPendingEmployeeShift((current) => ({ ...current, [field]: event.target.value }));
  };

  const closePendingShift = () => {
    setPendingEmployeeShift(null);
    setShiftFormError('');
  };

  const openDayView = (date) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    setDayViewDate(selectedDate);
    setRange(weekRangeOf(selectedDate));
    setIsDayView(true);
  };

  const closeTodayView = () => setIsDayView(false);

  const updateDayPeriod = (periodId, field, value) => {
    setDayPeriods((current) => current.map((period) => (
      period.id === periodId ? { ...period, [field]: value } : period
    )));
  };

  const onDayHourDrop = (event, hour) => {
    event.preventDefault();
    const employeeId = Number(event.dataTransfer.getData('application/vizura-employee'));
    if (!employeeId) return;
    setPendingEmployeeShift({
      employeeId,
      date: new Date(dayViewDate),
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: hour === 23 ? '23:59' : `${String(hour + 1).padStart(2, '0')}:00`,
    });
  };

  const addDroppedEmployeeShift = (event) => {
    event.preventDefault();
    if (!pendingEmployeeShift?.startTime || !pendingEmployeeShift?.endTime) {
      setShiftFormError('Start time and end time are required.');
      return;
    }

    const dateValue = [
      pendingEmployeeShift.date.getFullYear(),
      String(pendingEmployeeShift.date.getMonth() + 1).padStart(2, '0'),
      String(pendingEmployeeShift.date.getDate()).padStart(2, '0'),
    ].join('-');
    const startTime = new Date(`${dateValue}T${pendingEmployeeShift.startTime}:00`);
    const endTime = new Date(`${dateValue}T${pendingEmployeeShift.endTime}:00`);

    if (endTime <= startTime) {
      setShiftFormError('End time must be after start time.');
      return;
    }
    if (hasShiftOverlap(pendingEmployeeShift.employeeId, startTime, endTime)) {
      setShiftFormError('This employee already has a shift overlapping this time.');
      return;
    }
    const shiftHours = hoursBetween(startTime, endTime);
    const dailyHours = getDailyHours(pendingEmployeeShift.employeeId, startTime) + shiftHours;
    if (shiftHours > 9) setError('Warning: this shift is longer than 9 hours.');
    else if (dailyHours > 9) setError('Warning: this employee will be rostered for more than 9 hours on this day.');

    setShifts((current) => [...current, {
      Id: Date.now(),
      Subject: 'Shift',
      StartTime: startTime,
      EndTime: endTime,
      EmployeeId: pendingEmployeeShift.employeeId,
      RosterId: 1,
      IsPublished: false,
    }]);
    setError('');
    closePendingShift();
  };

  const updateShiftForm = (field) => (event) => {
    setShiftForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const addShift = (event) => {
    event.preventDefault();
    if (!shiftForm.date || !shiftForm.startTime || !shiftForm.endTime) {
      setShiftFormError('Date, start time, and end time are required.');
      return;
    }

    const startTime = new Date(`${shiftForm.date}T${shiftForm.startTime}:00`);
    const endTime = new Date(`${shiftForm.date}T${shiftForm.endTime}:00`);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      setShiftFormError('Enter a valid date and time.');
      return;
    }
    if (endTime <= startTime) {
      setShiftFormError('End time must be after start time.');
      return;
    }

    const employeeId = shiftForm.employeeId ? Number(shiftForm.employeeId) : null;
    const repeatCount = shiftForm.repeat === 'daily'
      ? 7
      : shiftForm.repeat === 'weekly'
        ? 4
        : 1;
    const repeatStepDays = shiftForm.repeat === 'daily'
      ? 1
      : 7;
    const repeatedShifts = Array.from({ length: repeatCount }, (_, index) => {
      const repeatedStart = new Date(startTime);
      const repeatedEnd = new Date(endTime);
      repeatedStart.setDate(repeatedStart.getDate() + (index * repeatStepDays));
      repeatedEnd.setDate(repeatedEnd.getDate() + (index * repeatStepDays));
      if (hasShiftOverlap(employeeId, repeatedStart, repeatedEnd)) {
        return null;
      }
      return {
        Id: Date.now() + index,
        Subject: shiftForm.section || 'Shift',
        Section: shiftForm.section,
        StartTime: repeatedStart,
        EndTime: repeatedEnd,
        EmployeeId: employeeId,
        RosterId: 1,
        IsPublished: false,
      };
    });

    const validShifts = repeatedShifts.filter(Boolean);
    if (employeeId && validShifts.length !== repeatCount) {
      setShiftFormError('A repeated shift overlaps an existing shift. No shifts were added.');
      return;
    }

    const shiftHours = hoursBetween(startTime, endTime);
    if (shiftHours > 9) setError('Warning: this shift is longer than 9 hours.');
    else if (employeeId && getDailyHours(employeeId, startTime) + shiftHours > 9) {
      setError('Warning: this employee will be rostered for more than 9 hours on this day.');
    }

    if (shiftForm.templateName.trim()) {
      const nextTemplates = [...templates, {
        id: `${Date.now()}-template`,
        name: shiftForm.templateName.trim(),
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        section: shiftForm.section,
        employeeId: employeeId ? String(employeeId) : '',
      }];
      setTemplates(nextTemplates);
      localStorage.setItem('vizura-roster-templates', JSON.stringify(nextTemplates));
    }

    setShifts((current) => [...current, ...validShifts]);
    setError('');
    closeShiftForm();
  };

  const onCalendarDrop = async (event) => {
    event.preventDefault();

    const employeeId = Number(event.dataTransfer.getData('application/vizura-employee'));
    if (!employeeId || !scheduler.current) return;

    const appointment = event.target.closest?.('[data-roster-shift-id]');
    if (appointment) {
      const shiftId = Number(appointment.dataset.rosterShiftId);
      setShifts((current) => current.map((shift) => (
        shift.Id === shiftId ? { ...shift, EmployeeId: employeeId } : shift
      )));
      setError('');
      return;
    }

    const cellDetails = scheduler.current.getCellDetails(event.target);
    if (!cellDetails?.startTime) {
      setError('Drop the employee onto an available calendar time.');
      return;
    }

    setPendingEmployeeShift({
      employeeId,
      date: new Date(cellDetails.startTime),
      startTime: '09:00',
      endTime: '17:00',
    });
    setShiftFormError('');
  };

  const onEmployeeDragStart = (event, employeeId) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/vizura-employee', String(employeeId));
  };

  const onEventRendered = (args) => {
    const published = args.data.IsPublished;
    const unallocated = !args.data.EmployeeId;
    args.element.dataset.rosterShiftId = String(args.data.Id);
    args.element.classList.toggle(
      'roster-selected-shift',
      selectedEmployeeId !== null && args.data.EmployeeId === selectedEmployeeId,
    );
    args.element.style.backgroundColor = unallocated
      ? '#fef3c7'
      : (published ? '#2563eb' : '#dbeafe');
    args.element.style.color = unallocated
      ? '#92400e'
      : (published ? '#fff' : '#1e3a8a');
    args.element.style.border = unallocated
      ? '1px dashed #d97706'
      : (published ? 'none' : '1px dashed #2563eb');
  };

  const eventTemplate = (props) => {
    const employee = employees.find((record) => record.id === props.EmployeeId);
    return (
      <div className="roster-event-template px-1 text-xs leading-tight">
        {props.Section && <strong className="block truncate">{props.Section}</strong>}
        {employee?.name
          ? <strong className="block truncate">{employee.name}</strong>
          : <strong className="roster-assign-label">Assign employee</strong>}
        <span>
          {props.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
          {props.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    );
  };

  const hasDrafts = shifts.some((s) => !s.IsPublished);
  const visibleEmployees = employees.filter((employee) => !employee.placeholder);
  const userPosition = String(user?.position || user?.role || '').toLowerCase();
  const isAdmin = !user || ['admin', 'administrator', 'owner', 'manager'].includes(userPosition);
  const totalHours = Object.values(hoursByEmployee).reduce((total, hours) => total + hours, 0);
  const rangeLabel = `${shortDateFormatter.format(range.start)} - ${dateFormatter.format(range.end)}`;
  const estimatedLabourCost = shifts.reduce((total, shift) => {
    const employee = employees.find((record) => record.id === shift.EmployeeId);
    return total + (hoursBetween(shift.StartTime, shift.EndTime) * (employee?.hourlyRate || 0));
  }, 0);

  return (
    <div className="roster-page bg-transparent p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <section className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="roster-stat-card">
            <span className="roster-stat-label">Estimated labour cost</span>
            <strong>{currencyFormatter.format(estimatedLabourCost)}</strong>
            <span className="roster-stat-detail">For week of {rangeLabel} · Based on employee rates</span>
          </div>
          <div className="roster-stat-card">
            <span className="roster-stat-label">Total scheduled hours</span>
            <strong>{totalHours.toFixed(1)}h</strong>
            <span className="roster-stat-detail">Across {visibleEmployees.length} employees</span>
          </div>
        </section>

        {error && (
          <div role="alert" className="roster-alert mb-4">
            {error}
          </div>
        )}

        <div className="roster-content-grid">
          <div
            className="overflow-hidden rounded-xl border border-sky-200/80 bg-white/80 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onCalendarDrop}
          >
            <div className="roster-calendar-header">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Shift schedule</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Drag events to adjust timing or resize to change duration.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isDayView && (
                  <button
                    type="button"
                    onClick={closeTodayView}
                    className="roster-secondary-button"
                  >
                    Back to week
                  </button>
                )}
                {isAdmin && (
                  <button type="button" onClick={openShiftForm} className="roster-secondary-button">
                    Add shift
                  </button>
                )}
                <button
                  type="button"
                  onClick={publishWeek}
                  disabled={busy || !hasDrafts}
                  className="roster-primary-button"
                >
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
                onUpdatePeriod={updateDayPeriod}
                onHourDrop={onDayHourDrop}
                onOpenShift={openShiftDetails}
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
                allowDragAndDrop
                allowResizing
                eventSettings={{
                  dataSource: shifts,
                  template: eventTemplate,
                  fields: {
                    id: 'Id',
                    subject: { name: 'Subject', default: 'Shift' },
                    startTime: { name: 'StartTime' },
                    endTime: { name: 'EndTime' },
                  },
                }}
                eventRendered={onEventRendered}
                actionComplete={onActionComplete}
                dateHeaderTemplate={(props) => {
                  const date = props.date;
                  if (!date) return null;
                  return (
                    <button
                      type="button"
                      className="roster-date-header"
                      onClick={() => openDayView(date)}
                    >
                      {new Date(date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </button>
                  );
                }}
                actionBegin={(args) => {
                  if (args.requestType === 'eventSelect') {
                    openShiftDetails(args.data.Id);
                  }
                  if (['eventCreate', 'eventEdit', 'cellEdit'].includes(args.requestType)) {
                    args.cancel = true;
                  }
                }}
              >
                <ViewsDirective>
                  <ViewDirective option="Day" displayName="Day view" />
                  <ViewDirective option="TimelineWeek" displayName="Week view" />
                  <ViewDirective option="TimelineMonth" displayName="Month view" />
                </ViewsDirective>
                <Inject services={[TimelineViews, TimelineMonth, Day, DragAndDrop, Resize]} />
              </ScheduleComponent>
            )}
            </div>
          </div>

          <RosterTeam
            employees={visibleEmployees}
            hoursByEmployee={hoursByEmployee}
            onDragStart={onEmployeeDragStart}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
          />
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
        <ShiftDetailsModal
          shift={selectedShift}
          employees={employees}
          onClose={closeShiftDetails}
        />
        <DroppedShiftModal
          pending={pendingEmployeeShift}
          employees={employees}
          error={shiftFormError}
          onChange={updatePendingTime}
          onClose={closePendingShift}
          onSubmit={addDroppedEmployeeShift}
        />
      </div>
    </div>
  );
}
