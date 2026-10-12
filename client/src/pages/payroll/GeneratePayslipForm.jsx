import { useState } from 'react'
import { Button } from 'flowbite-react'
import { generatePayslip } from '../../services/payrollApi'

const inputClass = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/10 dark:bg-slate-950/60 dark:text-white'
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1'

const initialForm = {
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
}

function GeneratePayslipForm() {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field) => (e) => {
    setForm((cur) => ({ ...cur, [field]: e.target.value }))
  }

  const handleGenerate = async () => {
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

  return (
    <div className="rounded-2xl border border-sky-200/80 bg-white/85 p-5 shadow-sm dark:border-white/15 dark:bg-white/10">
      <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Generate payslip</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <option value="fixed_term">Fixed term</option>
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
          <input type="date" className={inputClass} value={form.payPeriodStart} onChange={handleChange('payPeriodStart')} />
        </div>
        <div>
          <label className={labelClass}>Pay period end</label>
          <input type="date" className={inputClass} value={form.payPeriodEnd} onChange={handleChange('payPeriodEnd')} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Button
        className="mt-4 rounded-2xl bg-sky-500 px-6 text-white hover:bg-sky-400"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate payslip'}
      </Button>
    </div>
  )
}

export default GeneratePayslipForm