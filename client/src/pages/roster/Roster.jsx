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
const emptyRosterRows = [
  { id: 2, name: 'Open employee slot', role: 'Available for assignment', color: '#94a3b8', placeholder: true },
  { id: 3, name: 'Open employee slot', role: 'Available for assignment', color: '#94a3b8', placeholder: true },
  { id: 4, name: 'Open employee slot', role: 'Available for assignment', color: '#94a3b8', placeholder: true },
  { id: 5, name: 'Open employee slot', role: 'Available for assignment', color: '#94a3b8', placeholder: true },
];
import {
  readDemoShifts,
  testEmployee,
  writeDemoShifts,
} from '../../services/demoRoster';
import './Roster.css';

/* ------------------------------ page ------------------------------- */
export default function Rostering() {
  const scheduler = useRef(null);
  const [employees] = useState([testEmployee, ...emptyRosterRows]);
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
    window.addEventListener('storage', refreshShifts);
    return () => {
      window.removeEventListener('storage', refreshShifts);
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
      <div className={`flex flex-col leading-tight ${emp?.placeholder ? 'roster-empty-resource' : ''}`}>
        <span className="font-medium">{emp?.name}</span>
        <span className="text-xs text-gray-500">
          {emp?.placeholder ? emp.role : `${emp?.role} - ${hrs.toFixed(1)}h`}
        </span>
      </div>
    );
  };

  const eventTemplate = (props) => (
    <div className="px-1 text-xs">
      {props.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
      {props.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </div>
  );

  const hasDrafts = shifts.some((s) => !s.IsPublished);
  const visibleEmployees = employees.filter((employee) => !employee.placeholder);

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mx-auto max-w-[1600px]">
        <section className="mb-6 flex flex-col gap-4 border-y border-sky-200/70 bg-white/85 px-4 pb-5 pt-0 shadow-none backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-slate-900/35 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-2xl font-semibold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-200/90">
              Roster
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-sky-100/70">Plan and publish employee shifts.</p>
          </div>
          <button
            onClick={publishWeek}
            disabled={busy || !hasDrafts}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publish roster
          </button>
        </section>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div
            className="overflow-hidden rounded-xl border border-sky-200/80 bg-white/80 shadow-lg shadow-sky-200/40 backdrop-blur-md transition-colors duration-200 dark:border-white/15 dark:bg-white/10 dark:shadow-none"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onCalendarDrop}
          >
            <ScheduleComponent
              ref={scheduler}
              className="roster-schedule"
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
              {visibleEmployees.map((employee) => (
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
      </div>
    </div>
  );
}
