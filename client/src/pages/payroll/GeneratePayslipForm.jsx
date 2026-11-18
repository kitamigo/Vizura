import { useEffect, useState } from 'react'
import { Button } from 'flowbite-react'
import { generatePayslip } from '../../services/payrollApi'
import { readDemoShifts } from '../../services/demoRoster'

const cardClass = 'rounded-xl border border-sky-200/80 bg-white/80 p-5 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none'
const labelClass = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-sky-100/60'
const inputClass = 'mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/15 dark:bg-slate-950/50 dark:text-white'
const sectionClass = 'mt-5 border-t border-sky-100 pt-5 dark:border-white/10'
const initialForm = {
  employeeId: '',
  firstName: '',
  lastName: '',
  address: '',
  businessName: '',
  taxCode: 'M',
  irdNumber: '',
  kiwisaverRate: '3',
  hourlyRate: '',
  hoursWorked: '',
  payPeriodStart: '',
  payPeriodEnd: '',
  employmentType: 'permanent',
  shifts: [],
}

// YYYY-MM-DD format for the form
function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Monday to Sunday week default
function getWeekRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  }
}

// reads employees saved on this browser
function readEmployees() {
  try {
    return JSON.parse(localStorage.getItem('vizura-employees') || '[]')
  } catch {
    return []
  }
}

// gets roster shifts for the selected employee and pay period
function getRosterShifts(employeeId, start, end) {
  if (!employeeId || !start || !end) return []

  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T23:59:59`)

  return readDemoShifts()
    .filter((shift) => String(shift.EmployeeId) === String(employeeId))
    .filter((shift) => new Date(shift.StartTime) >= startDate)
    .filter((shift) => new Date(shift.StartTime) <= endDate)
    .map((shift) => {
      const startTime = new Date(shift.StartTime)
      const endTime = new Date(shift.EndTime)
      const hours = (endTime - startTime) / 36e5
      return {
        date: formatLocalDate(startTime),
        hours: Number.isFinite(hours) ? Math.max(0, hours) : 0,
      }
    })
    .filter((shift) => shift.hours > 0)
}

// limits payroll types (perm or casual)
function normaliseEmploymentType(value) {
  const normalised = String(value || 'permanent').trim().toLowerCase()
  return normalised === 'casual' ? 'casual' : 'permanent'
}

// manages payslip fields, roster hours and PDF generation
function GeneratePayslipForm() {
  const [payPeriod, setPayPeriod] = useState(getWeekRange)
  const [form, setForm] = useState(() => ({
    ...initialForm,
    payPeriodStart: payPeriod.start,
    payPeriodEnd: payPeriod.end,
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState(readEmployees)
  const [autoGenerate, setAutoGenerate] = useState(true)

  useEffect(() => {
    const refreshEmployees = () => setEmployees(readEmployees())
    window.addEventListener('storage', refreshEmployees)
    window.addEventListener('vizura-employees-changed', refreshEmployees)

    return () => {
      window.removeEventListener('storage', refreshEmployees)
      window.removeEventListener('vizura-employees-changed', refreshEmployees)
    }
  }, [])

  const selectEmployee = (employeeId) => {
    const employee = employees.find((item) => String(item.id) === String(employeeId))
    const shifts = getRosterShifts(employeeId, payPeriod.start, payPeriod.end)
    const hours = shifts.reduce((total, shift) => total + shift.hours, 0)

    setForm((current) => ({
      ...current,
      employeeId,
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
      taxCode: employee?.taxCode || 'M',
      irdNumber: employee?.irdNumber || '',
      kiwisaverRate: employee?.kiwisaverRate || '3',
      hourlyRate: employee?.hourlyRate || '',
      hoursWorked: hours ? Number(hours.toFixed(2)).toString() : '',
      payPeriodStart: payPeriod.start,
      payPeriodEnd: payPeriod.end,
      employmentType: normaliseEmploymentType(employee?.employmentType),
      shifts,
    }))
  }

  const handleChange = (field) => (e) => {
    setForm((cur) => ({ ...cur, [field]: e.target.value }))
  }
  const handlePayPeriodChange = (field) => (event) => {
    const value = event.target.value
    const nextPeriod = { ...payPeriod, [field === 'payPeriodStart' ? 'start' : 'end']: value }
    setPayPeriod(nextPeriod)
    setForm((current) => {
      const shifts = getRosterShifts(current.employeeId, nextPeriod.start, nextPeriod.end)
      return {
        ...current,
        [field]: value,
        hoursWorked: shifts.reduce((total, shift) => total + shift.hours, 0).toFixed(2),
        shifts,
      }
    })
  }

  const handleGenerate = async () => {
    if (
      !form.firstName ||
      !form.lastName ||
      !form.hourlyRate ||
      !form.hoursWorked ||
      !form.payPeriodStart ||
      !form.payPeriodEnd
    ) {
      setError('Select an employee and complete the pay period before generating.')
      return
    }

    if (form.payPeriodEnd < form.payPeriodStart) {
      setError('Pay period end must be after the start date.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await generatePayslip(form)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate payslip.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (
      !autoGenerate ||
      !form.employeeId ||
      !form.hourlyRate ||
      !form.hoursWorked ||
      !form.payPeriodStart ||
      !form.payPeriodEnd
    ) return

    const timer = window.setTimeout(handleGenerate, 350)
    return () => window.clearTimeout(timer)
  }, [autoGenerate, form.employeeId, form.hourlyRate, form.hoursWorked, form.payPeriodStart, form.payPeriodEnd])

  // - Generate payslip form - //
  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Generate payslip</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">
            Required fields are marked with an asterisk
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(event) => setAutoGenerate(event.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          Automatic payslip
        </label>
      </div>

      <div className={sectionClass}>
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Employee and pay period</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Employee from roster *</span>
            <select
              className={inputClass}
              value={form.employeeId}
              onChange={(event) => selectEmployee(event.target.value)}
            >
              <option value="">Select an employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {`${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unnamed employee'}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Pay period start *</span>
            <input type="date" className={inputClass} value={form.payPeriodStart} onChange={handlePayPeriodChange('payPeriodStart')} />
          </label>
          <label>
            <span className={labelClass}>Pay period end *</span>
            <input type="date" className={inputClass} value={form.payPeriodEnd} onChange={handlePayPeriodChange('payPeriodEnd')} />
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Personal details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>First name *</span>
            <input className={inputClass} value={form.firstName} onChange={handleChange('firstName')} />
          </label>
          <label>
            <span className={labelClass}>Last name *</span>
            <input className={inputClass} value={form.lastName} onChange={handleChange('lastName')} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Address</span>
            <input className={inputClass} value={form.address} onChange={handleChange('address')} />
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Employment and payroll</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className={labelClass}>Business name</span>
            <input className={inputClass} value={form.businessName} onChange={handleChange('businessName')} />
          </label>
          <label>
            <span className={labelClass}>Employment type</span>
            <select className={inputClass} value={form.employmentType} onChange={handleChange('employmentType')}>
              <option value="permanent">Permanent</option>
              <option value="casual">Casual</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Tax code</span>
            <input className={inputClass} value={form.taxCode} onChange={handleChange('taxCode')} />
          </label>
          <label>
            <span className={labelClass}>IRD number</span>
            <input className={inputClass} value={form.irdNumber} onChange={handleChange('irdNumber')} />
          </label>
          <label>
            <span className={labelClass}>KiwiSaver rate (%)</span>
            <input type="number" step="0.5" className={inputClass} value={form.kiwisaverRate} onChange={handleChange('kiwisaverRate')} />
          </label>
          <label>
            <span className={labelClass}>Hourly rate (NZD) *</span>
            <input type="number" step="0.01" className={inputClass} value={form.hourlyRate} onChange={handleChange('hourlyRate')} />
          </label>
          <label>
            <span className={labelClass}>Hours worked *</span>
            <input type="number" step="0.1" className={inputClass} value={form.hoursWorked} onChange={handleChange('hoursWorked')} />
          </label>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-300/20 dark:bg-rose-950/20">{error}</p>}

      <div className="mt-5 flex justify-end border-t border-sky-100 pt-5 dark:border-white/10">
        <Button
          className="rounded-lg bg-sky-500 px-6 text-white hover:bg-sky-400"
          onClick={handleGenerate}
          disabled={loading || !form.employeeId}
        >
          {loading ? 'Generating...' : 'Generate payslip'}
        </Button>
      </div>
    </div>
  )
}

export default GeneratePayslipForm