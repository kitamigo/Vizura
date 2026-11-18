import { useEffect, useState } from 'react'
import { Button } from 'flowbite-react'
import { generatePayslip } from '../../services/payrollApi'
import { readDemoShifts } from '../../services/demoRoster'

const inputClass = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/10 dark:bg-slate-950/60 dark:text-white'
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1'
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

  // - Generate payslip form - //
  return (
    <div className="rounded-2xl border border-sky-200/80 bg-white/85 p-5 shadow-sm dark:border-white/15 dark:bg-white/10">
      <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Generate payslip</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Employee from roster</label>
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
        </div>
        <div>
          <label className={labelClass}>First name</label>
          <input className={inputClass} value={form.firstName} onChange={handleChange('firstName')} />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input className={inputClass} value={form.lastName} onChange={handleChange('lastName')} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input className={inputClass} value={form.address} onChange={handleChange('address')} />
        </div>
        <div>
          <label className={labelClass}>Business name</label>
          <input className={inputClass} value={form.businessName} onChange={handleChange('businessName')} />
        </div>
        <div>
          <label className={labelClass}>Employment type</label>
          <select className={inputClass} value={form.employmentType} onChange={handleChange('employmentType')}>
            <option value="permanent">Permanent</option>
            <option value="casual">Casual</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Tax code</label>
          <input className={inputClass} value={form.taxCode} onChange={handleChange('taxCode')} />
        </div>
        <div>
          <label className={labelClass}>IRD number</label>
          <input className={inputClass} value={form.irdNumber} onChange={handleChange('irdNumber')} />
        </div>
        <div>
          <label className={labelClass}>KiwiSaver rate (%)</label>
          <input type="number" step="0.5" className={inputClass} value={form.kiwisaverRate} onChange={handleChange('kiwisaverRate')} />
        </div>
        <div>
          <label className={labelClass}>Hourly rate ($)</label>
          <input type="number" step="0.01" className={inputClass} value={form.hourlyRate} onChange={handleChange('hourlyRate')} />
        </div>
        <div>
          <label className={labelClass}>Hours worked</label>
          <input type="number" step="0.1" className={inputClass} value={form.hoursWorked} onChange={handleChange('hoursWorked')} />
        </div>
        <div>
          <label className={labelClass}>Pay period start</label>
          <input type="date" className={inputClass} value={form.payPeriodStart} onChange={handlePayPeriodChange('payPeriodStart')} />
        </div>
        <div>
          <label className={labelClass}>Pay period end</label>
          <input type="date" className={inputClass} value={form.payPeriodEnd} onChange={handlePayPeriodChange('payPeriodEnd')} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Button
        className="mt-4 rounded-2xl bg-sky-500 px-6 text-white hover:bg-sky-400"
        onClick={handleGenerate}
        disabled={loading || !form.employeeId}
      >
        {loading ? 'Generating...' : 'Generate payslip'}
      </Button>
    </div>
  )
}

export default GeneratePayslipForm