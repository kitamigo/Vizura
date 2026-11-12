import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScheduleComponent,
  ViewsDirective,
  ViewDirective,
  ResourcesDirective,
  ResourceDirective,
  Inject,
  TimelineViews,
  TimelineMonth,
  Week,
  DragAndDrop,
  Resize,
} from '@syncfusion/ej2-react-schedule';

/* ----------------------------- helpers ----------------------------- */
const mondayOf = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const hoursBetween = (a, b) => (b - a) / 36e5;
const shiftDurationMs = 60 * 60 * 1000;
const formatDate = (date) => date.toLocaleDateString([], { day: '2-digit', month: 'short' });
import {
  demoRosterChangedEvent,
  readDemoShifts,
  readDemoEmployees,
  writeDemoShifts,
} from '../../services/demoRoster';

/* ------------------------------ page ------------------------------- */
export default function Rostering() {
  const scheduler = useRef(null);
  const [employees, setEmployees] = useState(readDemoEmployees);
  const [range, setRange] = useState(() => {
    const start = mondayOf(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  });
  const [shifts, setShifts] = useState(readDemoShifts);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    writeDemoShifts(shifts);
  }, [shifts]);

  useEffect(() => {
    const refreshShifts = () => setShifts(readDemoShifts());
    const refreshEmployees = () => setEmployees(readDemoEmployees());
    window.addEventListener('storage', refreshShifts);
    window.addEventListener('storage', refreshEmployees);
    window.addEventListener(demoRosterChangedEvent, refreshEmployees);
    return () => {
      window.removeEventListener('storage', refreshShifts);
      window.removeEventListener('storage', refreshEmployees);
      window.removeEventListener(demoRosterChangedEvent, refreshEmployees);
    };
  }, []);

  /* weekly hours per employee, shown in the row header */
  const hoursByEmployee = useMemo(() => {
    const totals = {};
    shifts.forEach((s) => {
      totals[s.EmployeeId] = (totals[s.EmployeeId] ?? 0) + hoursBetween(s.StartTime, s.EndTime);
    });
    return totals;
  }, [shifts]);

  /* Demo mode keeps roster edits local until the real roster service is connected. */
  const onActionComplete = (args) => {
    const { requestType } = args;

    if (requestType === 'dateNavigate' || requestType === 'viewNavigate') {
      const dates = scheduler.current.getCurrentViewDates();
      setRange({ start: dates[0], end: dates[dates.length - 1] });
      return;
    }

    if (!['eventCreated', 'eventChanged', 'eventRemoved'].includes(requestType)) return;

    setError('');
    if (requestType === 'eventCreated') {
      setShifts((current) => [...current, ...args.addedRecords]);
    }
    if (requestType === 'eventChanged') {
      setShifts((current) => current.map((shift) => (
        args.changedRecords.find((changed) => changed.Id === shift.Id) || shift
      )));
    }
    if (requestType === 'eventRemoved') {
      const removedIds = new Set(args.deletedRecords.map((event) => event.Id));
      setShifts((current) => current.filter((shift) => !removedIds.has(shift.Id)));
    }
  };

  const publishWeek = async () => {
    setBusy(true);
    setShifts((current) => current.map((shift) => ({ ...shift, IsPublished: true })));
    setBusy(false);
  };

  const onCalendarDrop = async (event) => {
    event.preventDefault();

    const employeeId = Number(event.dataTransfer.getData('application/vizura-employee'));
    if (!employeeId || !scheduler.current) return;

    const cellDetails = scheduler.current.getCellDetails(event.target);
    if (!cellDetails?.startTime) {
      setError('Drop the employee onto an available calendar time.');
      return;
    }

    const startTime = new Date(cellDetails.startTime);
    const endTime = new Date(startTime.getTime() + shiftDurationMs);
    setBusy(true);
    setError('');

    setShifts((current) => [...current, {
      Id: Date.now(),
      Subject: 'Test shift',
      StartTime: startTime,
      EndTime: endTime,
      EmployeeId: employeeId,
      RosterId: 1,
      IsPublished: false,
    }]);
    setBusy(false);
  };

  const onEmployeeDragStart = (event, employeeId) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/vizura-employee', String(employeeId));
  };

  const onEventRendered = (args) => {
    const published = args.data.IsPublished;
    args.element.style.backgroundColor = published ? '#2563eb' : '#dbeafe';
    args.element.style.color = published ? '#fff' : '#1e3a8a';
    args.element.style.border = published ? 'none' : '1px dashed #2563eb';
  };

  const resourceHeaderTemplate = (props) => {
    const emp = employees.find((e) => e.id === props.resourceData.id);
    const hrs = hoursByEmployee[props.resourceData.id] ?? 0;
    return (
      <div className="flex flex-col leading-tight">
        <span className="font-medium">{emp?.name}</span>
        <span className="text-xs text-gray-500">
          {emp?.role} Â· {hrs.toFixed(1)}h
        </span>
      </div>
    );
  };

  const eventTemplate = (props) => (
    <div className="px-1 text-xs">
      {props.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} â€“{' '}
      {props.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </div>
  );

  const hasDrafts = shifts.some((s) => !s.IsPublished);
  const scheduledHours = shifts.reduce((total, shift) => total + hoursBetween(shift.StartTime, shift.EndTime), 0);
  const unassignedShifts = shifts.filter((shift) => !shift.EmployeeId).length;
  const activeEmployeeCount = employees.filter((employee) => employee.status !== 'Inactive').length;
  const weekLabel = `${formatDate(range.start)} - ${formatDate(range.end)}`;

  const navigateWeek = (offset) => {
    const date = new Date(range.start);
    date.setDate(date.getDate() + offset * 7);
    scheduler.current?.goToDate(date);
  };

  const addShift = () => {
    const employee = employees[0];
    if (!employee || !scheduler.current) return;
    const start = new Date(range.start);
    start.setHours(9, 0, 0, 0);
    scheduler.current.addEvent({
      Id: Date.now(),
      Subject: `${employee.role || 'Employee'} shift`,
      StartTime: start,
      EndTime: new Date(start.getTime() + 8 * shiftDurationMs),
      EmployeeId: employee.id,
      RosterId: 1,
      IsPublished: false,
    });
  };

  return (
    <div className="min-h-screen bg-transparent p-4 text-slate-900 sm:p-6 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px]">
        <section className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold uppercase tracking-wide text-slate-900 dark:text-white">Rostering</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-sky-200 bg-white/70 p-1 text-xs dark:border-white/10 dark:bg-slate-900/60">
              <button type="button" onClick={() => navigateWeek(-1)} className="rounded px-2 py-1 hover:bg-sky-100 dark:hover:bg-white/10" aria-label="Previous week">‹</button>
              <span className="min-w-32 px-2 text-center font-medium">{weekLabel}</span>
              <button type="button" onClick={() => navigateWeek(1)} className="rounded px-2 py-1 hover:bg-sky-100 dark:hover:bg-white/10" aria-label="Next week">›</button>
            </div>
            <button type="button" onClick={addShift} className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-400">＋ Add shift</button>
            <button
              type="button"
              onClick={publishWeek}
              disabled={busy || !hasDrafts}
              className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Publish
            </button>
          </div>
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total scheduled hours', `${scheduledHours.toFixed(0)} hrs`, '+14.2% vs last week', 'text-cyan-400'],
            ['Est. labor cost', '$3,145', '+$320 vs last week', 'text-white'],
            ['Active employees', `${activeEmployeeCount} Scheduled`, 'On track vs last week', 'text-white'],
            ['Unassigned shifts', `${unassignedShifts} Open`, '−3 vs last week', 'text-white'],
          ].map(([label, value, note, valueClass]) => (
            <article key={label} className="rounded-xl border border-sky-200/70 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
              <p className={`mt-2 text-xl font-semibold ${valueClass}`}>{value}</p>
              <p className="mt-1 text-[10px] text-emerald-500">{note}</p>
            </article>
          ))}
        </section>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Schedule Grid <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-semibold text-emerald-500">Live View</span></h2>
          </div>
          <div className="hidden gap-2 sm:flex">
            <select className="rounded-md border border-sky-200 bg-white/70 px-2 py-1 text-[10px] dark:border-white/10 dark:bg-slate-900/60" defaultValue="all">
              <option value="all">Filter by Role: All</option>
              {[...new Set(employees.map((employee) => employee.role).filter(Boolean))].map((role) => <option key={role}>{role}</option>)}
            </select>
            <button type="button" className="rounded-md border border-sky-200 bg-white/70 px-2 py-1 text-[10px] dark:border-white/10 dark:bg-slate-900/60">Sort: Name</button>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div
            className="roster-schedule overflow-hidden rounded-xl border border-sky-200/80 bg-white/80 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onCalendarDrop}
          >
            <ScheduleComponent
              ref={scheduler}
              height="600px"
              width="100%"
              currentView="TimelineWeek"
              selectedDate={range.start}
              firstDayOfWeek={1}
              startHour="06:00"
              endHour="24:00"
              showQuickInfo={false}
              rowAutoHeight
              allowDragAndDrop
              allowResizing
              group={{ resources: ['Employees'] }}
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
              resourceHeaderTemplate={resourceHeaderTemplate}
              eventRendered={onEventRendered}
              actionComplete={onActionComplete}
            >
              <ResourcesDirective>
                <ResourceDirective
                  field="EmployeeId"
                  title="Employee"
                  name="Employees"
                  dataSource={employees}
                  textField="name"
                  idField="id"
                  colorField="color"
                />
              </ResourcesDirective>
              <ViewsDirective>
                <ViewDirective option="TimelineWeek" />
                <ViewDirective option="TimelineMonth" />
                <ViewDirective option="Week" />
              </ViewsDirective>
              <Inject services={[TimelineViews, TimelineMonth, Week, DragAndDrop, Resize]} />
            </ScheduleComponent>
          </div>

          <aside className="rounded-xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Employees</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">Drag an employee onto a calendar time.</p>
            <div className="mt-4 space-y-2">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  draggable
                  onDragStart={(event) => onEmployeeDragStart(event, employee.id)}
                  className="cursor-grab rounded-lg border border-sky-200/80 bg-sky-50/60 p-3 transition hover:border-sky-400 hover:bg-sky-100 active:cursor-grabbing dark:border-white/15 dark:bg-slate-900/40 dark:hover:border-sky-300/60 dark:hover:bg-slate-900/60"
                >
                  <p className="font-medium text-slate-900 dark:text-white">{employee.name}</p>
                  <p className="text-xs text-slate-600 dark:text-sky-100/70">{employee.role || 'Employee'}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-sky-100/70">
                    {hoursByEmployee[employee.id]?.toFixed(1) ?? '0.0'}h scheduled
                  </p>
                </div>
              ))}
              {!employees.length && (
                <p className="text-sm text-gray-500">No employees available.</p>
              )}
            </div>
          </aside>
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/20 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Open &amp; Unassigned Shifts</h2>
            <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/70 p-3 text-xs dark:border-white/10 dark:bg-slate-950/40">
              {unassignedShifts
                ? `${unassignedShifts} shift${unassignedShifts === 1 ? '' : 's'} need an employee assignment.`
                : 'No unassigned shifts for this roster.'}
            </div>
          </article>
          <article className="rounded-xl border border-sky-200/80 bg-white/80 p-4 shadow-lg shadow-sky-200/20 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Compliance &amp; Overtime Flags</h2>
            <div className="mt-3 border-l-4 border-amber-400 pl-3 text-xs text-slate-600 dark:text-slate-300">
              {Object.entries(hoursByEmployee).some(([, hours]) => hours > 40)
                ? 'One or more employees exceed 40 scheduled hours.'
                : 'No overtime flags detected for this roster.'}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
