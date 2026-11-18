import { useEffect, useRef, useState } from 'react'

const employeeStorageKey = 'vizura-employees'
const categoryStorageKey = 'vizura-employee-categories'

const emptyEmployee = {
  id: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  category: '',
  status: 'Active',
  employmentType: 'Permanent',
  hourlyRate: '',
  taxCode: 'M',
  kiwisaverRate: '3',
  irdNumber: '',
  startDate: '',
  contractType: 'Permanent',
  contractFile: null,
  availability: {
    Monday: true,
    Tuesday: true,
    Wednesday: true,
    Thursday: true,
    Friday: true,
    Saturday: false,
    Sunday: false,
  },
}

const taxCodes = ['M', 'ME', 'SB', 'S', 'SH', 'ST', 'STC', 'AE', 'A', 'EDW', 'N', 'NC']
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function readStoredValue(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function EmployeeManagement() {
  const [employees, setEmployees] = useState(() => readStoredValue(employeeStorageKey, []))
  const [categories, setCategories] = useState(() => readStoredValue(categoryStorageKey, ['Staff', 'Kitchen', 'Front of house']))
  const [selectedId, setSelectedId] = useState(null)
  const [employee, setEmployee] = useState(emptyEmployee)
  const [categoryName, setCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileInput = useRef(null)

  useEffect(() => {
    localStorage.setItem(employeeStorageKey, JSON.stringify(employees))
  }, [employees])

  useEffect(() => {
    localStorage.setItem(categoryStorageKey, JSON.stringify(categories))
  }, [categories])

  const cardClass = 'rounded-xl border border-sky-200/80 bg-white/80 p-5 shadow-lg shadow-sky-200/30 backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-none'
  const labelClass = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-sky-100/60'
  const inputClass = 'mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-white/15 dark:bg-slate-950/50 dark:text-white'
  const sectionClass = 'mt-5 border-t border-sky-100 pt-5 dark:border-white/10'

  const updateEmployee = (field) => (event) => {
    setEmployee((current) => ({ ...current, [field]: event.target.value }))
    setSaved(false)
    setFormError('')
  }

  const toggleAvailability = (day) => {
    setEmployee((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [day]: !current.availability[day],
      },
    }))
  }

  const startNewEmployee = () => {
    setSelectedId(null)
    setEmployee({
      ...emptyEmployee,
      category: categories[0] || '',
    })
    setSaved(false)
    setFormError('')
  }

  const selectEmployee = (record) => {
    setSelectedId(record.id)
    setEmployee(record)
    setSaved(false)
    setFormError('')
  }

  const handleContractUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(extension)) {
      setFormError('Contract must be a PDF, DOC, or DOCX file.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Contract files must be smaller than 5 MB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setEmployee((current) => ({
        ...current,
        contractFile: {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
        },
      }))
    }
    reader.readAsDataURL(file)
  }

  const removeContract = () => {
    setEmployee((current) => ({ ...current, contractFile: null }))
    if (fileInput.current) fileInput.current.value = ''
  }

  const addCategory = (event) => {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) return
    if (categories.some((category) => category.toLowerCase() === name.toLowerCase())) {
      setCategoryError('That category already exists.')
      return
    }
    setCategories((current) => [...current, name])
    setCategoryName('')
    setCategoryError('')
  }

  const removeCategory = (name) => {
    setCategories((current) => current.filter((category) => category !== name))
    setEmployees((current) => current.map((record) => (
      record.category === name ? { ...record, category: '' } : record
    )))
  }

  const saveEmployee = () => {
    if (!employee.firstName.trim() || !employee.lastName.trim()) {
      setFormError('First name and last name are required.')
      return
    }
    if (!employee.email.trim()) {
      setFormError('Email address is required.')
      return
    }
    if (!employee.category) {
      setFormError('Select or create an employee category.')
      return
    }
    if (!employee.hourlyRate || Number(employee.hourlyRate) < 0) {
      setFormError('Enter a valid hourly pay rate.')
      return
    }
    if (!employee.taxCode) {
      setFormError('Select a tax code.')
      return
    }
    if (!employee.kiwisaverRate) {
      setFormError('Select a KiwiSaver rate or "Not enrolled".')
      return
    }

    const record = {
      ...employee,
      id: selectedId || Date.now(),
      firstName: employee.firstName.trim(),
      lastName: employee.lastName.trim(),
      email: employee.email.trim().toLowerCase(),
    }

    setEmployees((current) => (
      selectedId
        ? current.map((item) => (item.id === selectedId ? record : item))
        : [...current, record]
    ))
    setSelectedId(record.id)
    setEmployee(record)
    setSaved(true)
    setFormError('')
  }

  const deleteEmployee = () => {
    if (!selectedId) return
    setEmployees((current) => current.filter((record) => record.id !== selectedId))
    startNewEmployee()
  }

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-sky-100/70">
              Create profiles, categories, pay details, contracts, and availability.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewEmployee}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
          >
            Add employee
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Staff members', String(employees.length), 'Active employee profiles'],
            ['Categories', String(categories.length), 'Reusable staff groups'],
            ['With contracts', String(employees.filter((record) => record.contractFile).length), 'Uploaded documents'],
            ['Available this week', String(employees.filter((record) => record.status === 'Active').length), 'Active profiles'],
          ].map(([label, value, note]) => (
            <article key={label} className={cardClass}>
              <p className={labelClass}>{label}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className={cardClass}>
            <div className="flex items-center justify-between border-b border-sky-100 pb-4 dark:border-white/10">
              <div>
                <h2 className="text-base font-semibold">Staff directory</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">
                  {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {employees.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  onClick={() => selectEmployee(record)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedId === record.id
                      ? 'border-sky-400 bg-sky-50 dark:border-sky-300/50 dark:bg-slate-900/50'
                      : 'border-sky-100 bg-white/40 hover:border-sky-300 dark:border-white/10 dark:bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{record.firstName} {record.lastName}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      record.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                    }`}>
                      {record.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">{record.category || 'No category'}</p>
                </button>
              ))}
              {!employees.length && (
                <p className="rounded-lg border border-dashed border-sky-200 px-3 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                  No employees yet
                </p>
              )}
            </div>

            <div className="mt-5 border-t border-sky-100 pt-5 dark:border-white/10">
              <h3 className="text-sm font-semibold">Employee categories</h3>
              <form onSubmit={addCategory} className="mt-3 flex gap-2">
                <input
                  value={categoryName}
                  onChange={(event) => {
                    setCategoryName(event.target.value)
                    setCategoryError('')
                  }}
                  placeholder="New category"
                  className={inputClass}
                />
                <button type="submit" className="mt-1 rounded-lg bg-sky-500 px-3 text-sm font-semibold text-white">
                  Add
                </button>
              </form>
              {categoryError && <p className="mt-2 text-xs text-red-600">{categoryError}</p>}
              <div className="mt-3 space-y-1">
                {categories.map((category) => (
                  <div key={category} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sky-50 dark:hover:bg-white/5">
                    <span>{category}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(category)}
                      className="text-xs font-semibold text-slate-400 transition hover:text-red-600"
                      aria-label={`Delete ${category} category`}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <article className={cardClass}>
            <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedId ? `${employee.firstName} ${employee.lastName}`.trim() || 'Employee profile' : 'New employee'}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">
                  {selectedId ? 'Employee profile' : 'Required fields are marked with an asterisk'}
                </p>
              </div>
              {selectedId && (
                <button type="button" onClick={deleteEmployee} className="text-sm font-semibold text-red-600 hover:text-red-700">
                  Delete employee
                </button>
              )}
            </div>

            {formError && (
              <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-300/20 dark:bg-red-950/20">
                {formError}
              </p>
            )}
            {saved && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-950/20">
                Employee saved locally.
              </p>
            )}

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Personal details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>First name *</span>
                  <input className={inputClass} value={employee.firstName} onChange={updateEmployee('firstName')} />
                </label>
                <label>
                  <span className={labelClass}>Last name *</span>
                  <input className={inputClass} value={employee.lastName} onChange={updateEmployee('lastName')} />
                </label>
                <label>
                  <span className={labelClass}>Email address *</span>
                  <input type="email" className={inputClass} value={employee.email} onChange={updateEmployee('email')} />
                </label>
                <label>
                  <span className={labelClass}>Phone number</span>
                  <input type="tel" className={inputClass} value={employee.phone} onChange={updateEmployee('phone')} />
                </label>
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Employment and payroll</h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label>
                  <span className={labelClass}>Category *</span>
                  <select className={inputClass} value={employee.category} onChange={updateEmployee('category')}>
                    <option value="">Select category</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Employment type</span>
                  <select className={inputClass} value={employee.employmentType} onChange={updateEmployee('employmentType')}>
                    <option>Permanent</option>
                    <option>Casual</option>
                    <option>Fixed term</option>
                    <option>Part time</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Status</span>
                  <select className={inputClass} value={employee.status} onChange={updateEmployee('status')}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Hourly pay rate (NZD) *</span>
                  <input type="number" min="0" step="0.01" className={inputClass} value={employee.hourlyRate} onChange={updateEmployee('hourlyRate')} placeholder="0.00" />
                </label>
                <label>
                  <span className={labelClass}>Tax code *</span>
                  <select className={inputClass} value={employee.taxCode} onChange={updateEmployee('taxCode')}>
                    {taxCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>KiwiSaver rate *</span>
                  <select className={inputClass} value={employee.kiwisaverRate} onChange={updateEmployee('kiwisaverRate')}>
                    <option value="Not enrolled">Not enrolled</option>
                    <option value="3">3%</option>
                    <option value="4">4%</option>
                    <option value="6">6%</option>
                    <option value="8">8%</option>
                    <option value="10">10%</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>IRD number</span>
                  <input className={inputClass} value={employee.irdNumber} onChange={updateEmployee('irdNumber')} placeholder="123-456-789" />
                </label>
                <label>
                  <span className={labelClass}>Start date</span>
                  <input type="date" className={inputClass} value={employee.startDate} onChange={updateEmployee('startDate')} />
                </label>
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Contract</h3>
              <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <label>
                  <span className={labelClass}>Contract type</span>
                  <select className={inputClass} value={employee.contractType} onChange={updateEmployee('contractType')}>
                    <option>Permanent</option>
                    <option>Casual</option>
                    <option>Fixed term</option>
                    <option>Part time</option>
                  </select>
                </label>
                <div>
                  <span className={labelClass}>Contract document</span>
                  {employee.contractFile ? (
                    <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-sky-200 px-3 py-2 dark:border-white/15">
                      <a
                        href={employee.contractFile.dataUrl}
                        download={employee.contractFile.name}
                        className="truncate text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
                      >
                        {employee.contractFile.name}
                      </a>
                      <button type="button" onClick={removeContract} className="text-xs font-semibold text-red-600">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleContractUpload}
                      className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-200 dark:file:bg-sky-300/15 dark:file:text-sky-200"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Availability</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {days.map((day) => (
                  <label
                    key={day}
                    className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-3 text-xs font-semibold transition ${
                      employee.availability[day]
                        ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-300/50 dark:bg-sky-300/10 dark:text-sky-200'
                        : 'border-slate-200 text-slate-400 dark:border-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(employee.availability[day])}
                      onChange={() => toggleAvailability(day)}
                      className="sr-only"
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-sky-100 pt-5 sm:flex-row sm:justify-end dark:border-white/10">
              {selectedId && (
                <button type="button" onClick={startNewEmployee} className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-sky-400 dark:border-white/15 dark:text-slate-300">
                  Cancel
                </button>
              )}
              <button type="button" onClick={saveEmployee} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-600">
                {selectedId ? 'Save changes' : 'Save employee'}
              </button>
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}

export default EmployeeManagement
