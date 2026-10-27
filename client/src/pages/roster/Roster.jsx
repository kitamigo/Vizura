<<<<<<< Updated upstream
import { ScheduleComponent, Day, Week, Month, Agenda, Inject } from '@syncfusion/ej2-react-schedule';
import './Roster.css';


function Roster () {
  const data = [ // Filler meeting for example
    {
      Id: 1,
      Subject: 'Meeting - 1',
      StartTime: new Date(new Date().setHours(9,0,0)),
      EndTime: new Date(new Date().setHours(10,0,0)),
    }
  ];

  const eventSettings = { dataSource: data };

  return (
    <ScheduleComponent
      cssClass="roster-position"
      width="calc(80vw - 250px)"
      height="75vh"
      currentView="Week"
      views={['Day', 'Week', 'Month', 'Agenda']}
      eventSettings={eventSettings}
    >
      <Inject services={[Day, Week, Month, Agenda]} />
    </ScheduleComponent>
  );
};

export default Roster;
=======
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
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

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const rosterApi = {
  // employees for the business, each with { employee_id, first_name, last_name, role, hourly_rate }
  employees: () => api.get('/roster/employees').then((r) => r.data),

  // shifts overlapping the visible range
  shifts: (from, to) =>
    api.get('/roster/shifts', { params: { from, to } }).then((r) => r.data),


  ensureRoster: (weekStart) =>
    api.post('/roster/ensure', { week_start: weekStart }).then((r) => r.data), // -> { roster_id }

  createShift: (body) => api.post('/roster/shifts', body).then((r) => r.data),
  updateShift: (id, body) => api.put(`/roster/shifts/${id}`, body).then((r) => r.data),
  deleteShift: (id) => api.delete(`/roster/shifts/${id}`),
  publish: (rosterId) => api.post(`/roster/${rosterId}/publish`),
};

/* ----------------------------- helpers ----------------------------- */
const pad = (n) => String(n).padStart(2, '0');
const toDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

const mondayOf = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

// DB row -> Scheduler event
const toEvent = (s) => {
  const day = String(s.date).slice(0, 10);
  return {
    Id: s.shift_id,
    Subject: 'Shift',
    StartTime: new Date(`${day}T${s.start_time}`),
    EndTime: new Date(`${day}T${s.end_time}`),
    EmployeeId: s.employee_id,
    RosterId: s.roster_id,
    IsPublished: s.is_published,
  };
};

// Scheduler event -> DB payload
const toPayload = (e, rosterId) => ({
  employee_id: e.EmployeeId,
  roster_id: rosterId ?? e.RosterId,
  date: toDate(e.StartTime),
  start_time: toTime(e.StartTime),
  end_time: toTime(e.EndTime),
});

const hoursBetween = (a, b) => (b - a) / 36e5;

/* ------------------------------ page ------------------------------- */
export default function Rostering() {
  const scheduler = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [range, setRange] = useState(() => {
    const start = mondayOf(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadShifts = useCallback(async (start, end) => {
    try {
      const rows = await rosterApi.shifts(toDate(start), toDate(end));
      setShifts(rows.map(toEvent));
    } catch {
      setError('Could not load shifts. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    rosterApi
      .employees()
      .then((rows) =>
        setEmployees(
          rows.map((e) => ({
            id: e.employee_id,
            name: `${e.first_name} ${e.last_name}`,
            role: e.role,
            color: '#2563eb',
          }))
        )
      )
      .catch(() => setError('Could not load employees.'));
  }, []);

  useEffect(() => {
    loadShifts(range.start, range.end);
  }, [range, loadShifts]);

  /* weekly hours per employee, shown in the row header */
  const hoursByEmployee = useMemo(() => {
    const totals = {};
    shifts.forEach((s) => {
      totals[s.EmployeeId] = (totals[s.EmployeeId] ?? 0) + hoursBetween(s.StartTime, s.EndTime);
    });
    return totals;
  }, [shifts]);

  /* persist add / drag / resize / delete, then reload so the UI matches the DB */
  const onActionComplete = async (args) => {
    const { requestType } = args;

    if (requestType === 'dateNavigate' || requestType === 'viewNavigate') {
      const dates = scheduler.current.getCurrentViewDates();
      setRange({ start: dates[0], end: dates[dates.length - 1] });
      return;
    }

    if (!['eventCreated', 'eventChanged', 'eventRemoved'].includes(requestType)) return;

    setBusy(true);
    setError('');
    try {
      if (requestType === 'eventCreated') {
        for (const e of args.addedRecords) {
          const { roster_id } = await rosterApi.ensureRoster(toDate(mondayOf(e.StartTime)));
          await rosterApi.createShift(toPayload(e, roster_id));
        }
      }
      if (requestType === 'eventChanged') {
        for (const e of args.changedRecords) {
          await rosterApi.updateShift(e.Id, toPayload(e));
        }
      }
      if (requestType === 'eventRemoved') {
        for (const e of args.deletedRecords) await rosterApi.deleteShift(e.Id);
      }
    } catch (err) {
      // conflictDetector responses (double booking, overlap, leave) surface here
      const msg = err.response?.data?.error ?? err.response?.data?.message;
      setError(msg ?? 'That change could not be saved.');
    } finally {
      await loadShifts(range.start, range.end); // reverts the UI if the save failed
      setBusy(false);
    }
  };

  const publishWeek = async () => {
    const rosterIds = [...new Set(shifts.map((s) => s.RosterId))];
    if (!rosterIds.length) return;
    setBusy(true);
    try {
      await Promise.all(rosterIds.map(rosterApi.publish));
      await loadShifts(range.start, range.end);
    } catch {
      setError('Could not publish this roster.');
    } finally {
      setBusy(false);
    }
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
          {emp?.role} · {hrs.toFixed(1)}h
        </span>
      </div>
    );
  };

  const eventTemplate = (props) => (
    <div className="px-1 text-xs">
      {props.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
      {props.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </div>
  );

  const hasDrafts = shifts.some((s) => !s.IsPublished);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Rostering</h1>
            <p className="mt-1 text-sm text-gray-500">Plan and publish employee shifts.</p>
          </div>
          <button
            onClick={publishWeek}
            disabled={busy || !hasDrafts}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publish roster
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
      </div>
    </div>
  );
}
>>>>>>> Stashed changes
