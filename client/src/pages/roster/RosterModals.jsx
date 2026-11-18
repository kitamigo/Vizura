import { useEffect, useState } from 'react'
import { Datepicker } from 'flowbite-react'
import RosterDropdown from './RosterDropdown'

const datepickerTheme = {
  root: {
    input: {
      field: {
        icon: {
          base: 'hidden',
        },
        input: {
          base: 'block w-full cursor-pointer rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
          withIcon: {
            on: '',
            off: '',
          },
        },
      },
    },
  },
  popup: {
    header: {
      selectors: {
        button: {
          prev: 'pointer-events-none cursor-not-allowed opacity-40',
        },
      },
    },
  },
}

const toDateValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const rosterTimeOptions = [
  ...Array.from({ length: 48 }, (_, index) => {
    const hours = Math.floor(index / 2)
    const minutes = index % 2 === 0 ? '00' : '30'
    const value = `${String(hours).padStart(2, '0')}:${minutes}`
    const hour12 = hours % 12 || 12
    const period = hours < 12 ? 'AM' : 'PM'
    return { value, label: `${hour12}:${minutes} ${period}` }
  }),
  { value: '23:59', label: '11:59 PM' },
]

function RosterTimePicker({ value, onChange, label }) {
  return (
    <select
      className="roster-time-select"
      value={value}
      onMouseDown={() => {
        window.dispatchEvent(new CustomEvent('roster-popover-open', { detail: label }))
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      {rosterTimeOptions.map((time) => (
        <option key={time.value} value={time.value}>{time.label}</option>
      ))}
    </select>
  )
}

function Modal({ title, eyebrow, closeLabel = 'Close', onClose, children }) {
  return (
    <div className="roster-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="roster-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="roster-modal-header">
          <div>
            {eyebrow && <p className="roster-eyebrow">{eyebrow}</p>}
            <h2 id="roster-modal-title" className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="roster-modal-close" aria-label={closeLabel}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function AddShiftModal({
  open,
  form,
  sections,
  employees,
  templates = [],
  onLoadTemplate,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  const [datePickerKey, setDatePickerKey] = useState(0)

  useEffect(() => {
    if (!open) return undefined
    const closeDateOnOtherPopover = (event) => {
      if (event.detail !== 'date') {
        setDatePickerKey((current) => current + 1)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }
    }
    window.addEventListener('roster-popover-open', closeDateOnOtherPopover)
    return () => window.removeEventListener('roster-popover-open', closeDateOnOtherPopover)
  }, [open])

  if (!open) return null
  return (
    <Modal title="Add shift" closeLabel="Close add shift" onClose={onClose}>
      <form onSubmit={onSubmit} className="roster-shift-form">
        <label>
          <span>Date <b>*</b></span>
          <div
            className="roster-date-picker"
            onMouseDown={() => window.dispatchEvent(new CustomEvent('roster-popover-open', { detail: 'date' }))}
          >
            <Datepicker
              key={datePickerKey}
              theme={datepickerTheme}
              value={form.date ? new Date(`${form.date}T12:00:00`) : null}
              onChange={(date) => {
                if (date) onChange('date')({ target: { value: toDateValue(date) } })
              }}
              showTodayButton
              placeholder="Select shift date"
            />
          </div>
        </label>
        <div className="roster-form-times">
          <label>
            <span>Start time <b>*</b></span>
            <RosterTimePicker
              value={form.startTime}
              onChange={(value) => onChange('startTime')({ target: { value } })}
              label="Start time"
            />
          </label>
          <label>
            <span>End time <b>*</b></span>
            <RosterTimePicker
              value={form.endTime}
              onChange={(value) => onChange('endTime')({ target: { value } })}
              label="End time"
            />
          </label>
        </div>
        <label>
          <span>Section</span>
          <RosterDropdown
            value={form.section}
            placeholder="No section"
            options={[{ value: '', label: 'No section' }, ...sections.map((section) => ({ value: section, label: section }))]}
            onChange={(value) => onChange('section')({ target: { value } })}
            ariaLabel="Section"
          />
        </label>
        <label>
          <span>Repeat</span>
          <select
            value={form.repeat}
            onChange={(event) => onChange('repeat')({ target: { value: event.target.value } })}
            aria-label="Repeat"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily for 7 days</option>
            <option value="weekly">Weekly for 4 weeks</option>
          </select>
        </label>
        {templates.length > 0 && (
          <label>
            <span>Template</span>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) onLoadTemplate(event.target.value)
              }}
              aria-label="Load template"
            >
              <option value="">Load a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Save as template</span>
          <input
            type="text"
            value={form.templateName}
            onChange={(event) => onChange('templateName')({ target: { value: event.target.value } })}
            placeholder="Template name"
          />
        </label>
        <label>
          <span>Allocate person</span>
          <RosterDropdown
            value={form.employeeId}
            placeholder="Assign later"
            options={[
              { value: '', label: 'Assign later' },
              ...employees.map((employee) => ({ value: String(employee.id), label: employee.name })),
            ]}
            onChange={(value) => onChange('employeeId')({ target: { value } })}
            ariaLabel="Allocate person"
          />
        </label>
        {error && <p role="alert" className="roster-form-error">{error}</p>}
        <div className="roster-modal-actions">
          <button type="button" onClick={onClose} className="roster-secondary-button">Cancel</button>
          <button type="submit" className="roster-primary-button">Add shift</button>
        </div>
      </form>
    </Modal>
  )
}

export function ShiftDetailsModal({ shift, employees, onClose }) {
  if (!shift) return null
  const employee = employees.find((record) => record.id === shift.EmployeeId)
  return (
    <Modal title={shift.Section || 'Shift'} eyebrow="Shift details" onClose={onClose}>
      <dl className="roster-details-grid">
        <div>
          <dt>Date</dt>
          <dd>{shift.StartTime.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {shift.StartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
            {shift.EndTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </dd>
        </div>
        <div><dt>Employee</dt><dd>{employee?.name || 'Unassigned'}</dd></div>
        <div><dt>Status</dt><dd>{shift.IsPublished ? 'Published' : 'Draft'}</dd></div>
      </dl>
      <div className="roster-modal-actions">
        <button type="button" onClick={onClose} className="roster-primary-button">Close</button>
      </div>
    </Modal>
  )
}

export function DroppedShiftModal({ pending, employees, error, onChange, onClose, onSubmit }) {
  if (!pending) return null
  const employee = employees.find((record) => record.id === pending.employeeId)
  return (
    <Modal title={employee?.name || 'Employee'} eyebrow="New shift" onClose={onClose}>
      <form onSubmit={onSubmit} className="roster-shift-form">
        <div className="roster-form-times">
          <label>
            <span>Start time <b>*</b></span>
            <RosterTimePicker
              value={pending.startTime}
              onChange={(value) => onChange('startTime')({ target: { value } })}
              label="Start time"
            />
          </label>
          <label>
            <span>End time <b>*</b></span>
            <RosterTimePicker
              value={pending.endTime}
              onChange={(value) => onChange('endTime')({ target: { value } })}
              label="End time"
            />
          </label>
        </div>
        {error && <p role="alert" className="roster-form-error">{error}</p>}
        <div className="roster-modal-actions">
          <button type="button" onClick={onClose} className="roster-secondary-button">Cancel</button>
          <button type="submit" className="roster-primary-button">Add shift</button>
        </div>
      </form>
    </Modal>
  )
}

