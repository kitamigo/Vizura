import { useEffect, useRef, useState } from 'react'

const employeeStorageKey = 'vizura-employees'
const categoryStorageKey = 'vizura-employee-categories'
const categoryPresetMigrationKey = 'vizura-employee-category-presets-removed'
const removedPresetCategories = ['Staff', 'Kitchen', 'Front of house']

const emptyEmployee = {
  id: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  category: '',
  employmentType: 'Permanent',
  hourlyRate: '',
  minimumHours: '',
  taxCode: 'M',
  kiwisaverRate: '3',
  irdNumber: '',
  startDate: '',
  contractFile: null,
  availability: {
    Monday: { available: true, start: '00:00', end: '23:59' },
    Tuesday: { available: true, start: '00:00', end: '23:59' },
    Wednesday: { available: true, start: '00:00', end: '23:59' },
    Thursday: { available: true, start: '00:00', end: '23:59' },
    Friday: { available: true, start: '00:00', end: '23:59' },
    Saturday: { available: false, start: '00:00', end: '23:59' },
    Sunday: { available: false, start: '00:00', end: '23:59' },
  },
}

const taxCodes = [
  'M',
  'ME',
  'SB',
  'S',
  'SH',
  'ST',
  'STC',
  'AE',
  'A',
  'EDW',
  'N',
  'NC',
  'ND',
]
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const minimumHourlyRate = 23.95
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// formats names and separates the first letter for consistent profile display
const formatName = (value) => {
  const lettersOnly = value.replace(/[^a-zA-Z]/g, '')
  if (!lettersOnly) return ''
  return lettersOnly.charAt(0).toUpperCase() + lettersOnly.slice(1)
}

// normalises common New Zealand mobile and landline formats
const formatNZPhone = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('+64')) {
    const digits = trimmed.replace(/\D/g, '').replace(/^64/, '')
    if (!digits) return '+64'
    if (digits.length <= 2) return `+64 ${digits}`
    if (digits.length <= 5) return `+64 ${digits.slice(0, 2)} ${digits.slice(2)}`
    if (digits.length <= 8) return `+64 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
    return `+64 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0') && digits.length >= 8) {
    if (/^0[2-7]/.test(digits)) {
      if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
      if (digits.length === 9) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
    }
  }
  return trimmed
}

const isValidNZPhone = (value) => {
  if (!value) return true
  const digits = value.replace(/\D/g, '')
  if (value.startsWith('+64')) return digits.length >= 9 && digits.length <= 11
  return /^(?:02\d|03|04|06|07|09)\d{7,8}$/.test(digits)
}

const formatIRDNumber = (value) => {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 8 && digits.length !== 9) return value
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}
const timeOptions = [
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

function readStoredValue(key, fallback) {
  // keeps the page usable when storage is empty or contains invalid data
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function readStoredCategories() {
  // removes legacy preset categories once without affecting future custom categories
  const storedCategories = readStoredValue(categoryStorageKey, [])
  if (!localStorage.getItem(categoryPresetMigrationKey)) {
    const migratedCategories = storedCategories.filter(
      (category) => !removedPresetCategories.includes(category),
    )
    localStorage.setItem(categoryStorageKey, JSON.stringify(migratedCategories))
    localStorage.setItem(categoryPresetMigrationKey, 'true')
    return migratedCategories
  }
  return storedCategories
}

function readStoredEmployees() {
  const storedEmployees = readStoredValue(employeeStorageKey, [])
  // converts older boolean availability values into start and end time objects
  const migratedEmployees = storedEmployees.map((employee) => {
    const availability = {}
    days.forEach((day) => {
      const existing = employee.availability?.[day]
      availability[day] = typeof existing === 'object'
        ? {
          ...existing,
          start: existing.start === '24:00' ? '23:59' : existing.start,
          end: existing.end === '24:00' ? '23:59' : existing.end,
        }
        : {
          available: typeof existing === 'boolean' ? existing : false,
          start: '00:00',
          end: '23:59',
        }
    })

    return {
      ...employee,
      category: removedPresetCategories.includes(employee.category) ? '' : employee.category,
      availability,
    }
  })
  localStorage.setItem(employeeStorageKey, JSON.stringify(migratedEmployees))
  return migratedEmployees
}

function EmployeeManagement() {
  const [employees, setEmployees] = useState(readStoredEmployees)
  const [categories, setCategories] = useState(readStoredCategories)
  const [selectedId, setSelectedId] = useState(null)
  const [employee, setEmployee] = useState(emptyEmployee)
  const [categoryName, setCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(false)
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
  const clickableInputClass = `${inputClass} cursor-pointer`
  const sectionClass = 'mt-5 border-t border-sky-100 pt-5 dark:border-white/10'
  const fieldErrorClass = 'mt-1 text-xs font-medium text-red-600 dark:text-red-300'
  const fieldError = (field) => (
    fieldErrors[field]
      ? <p className={fieldErrorClass}>{fieldErrors[field]}</p>
      : null
  )
  const formatAvailabilityTime = (value) => (
    timeOptions.find((time) => time.value === value)?.label || value
  )
  const filteredEmployees = employees.filter((record) => {
    const search = searchQuery.trim().toLowerCase()
    if (!search) return true
    return `${record.firstName} ${record.lastName} ${record.category} ${record.email}`
      .toLowerCase()
      .includes(search)
  })

  const updateEmployee = (field) => (event) => {
    // normalises values as they are entered so saved records stay consistent
    let value = event.target.value
    if (['firstName', 'lastName', 'emergencyContactName'].includes(field)) {
      value = formatName(value)
    }
    if (['email'].includes(field)) {
      value = value.trim().toLowerCase()
    }
    setEmployee((current) => {
      if (field === 'employmentType') {
        return {
          ...current,
          employmentType: value,
          minimumHours: value === 'Casual' ? '0' : current.minimumHours,
        }
      }
      return { ...current, [field]: value }
    })
    setSaved(false)
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const toggleAvailability = (day) => {
    // keeps each day's schedule independent when availability changes
    setEmployee((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [day]: {
          ...current.availability[day],
          available: !current.availability[day]?.available,
        },
      },
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.availability
      return next
    })
  }

  const updateAvailabilityTime = (day, field) => (event) => {
    // updates only the selected time while preserving the other schedule values
    setEmployee((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [day]: {
          ...current.availability[day],
          [field]: event.target.value,
        },
      },
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.availability
      return next
    })
  }

  const startNewEmployee = () => {
    setSelectedId(null)
    setIsEditing(true)
    setFieldErrors({})
    setEmployee({
      ...emptyEmployee,
      category: categories[0] || '',
    })
    setSaved(false)
  }

  const selectEmployee = (record) => {
    setSelectedId(record.id)
    setEmployee(record)
    setIsEditing(false)
    setFieldErrors({})
    setSaved(false)
  }

  // restores the saved record when an edit is cancelled
  const cancelEdit = () => {
    const original = employees.find((record) => record.id === selectedId)
    if (original) setEmployee(original)
    setIsEditing(false)
    setFieldErrors({})
    setSaved(false)
  }

  const handleContractUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // limits contract uploads to supported document types and a 5 MB size
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(extension)) {
      setFieldErrors((current) => ({ ...current, contractFile: 'Contract must be a PDF, DOC, or DOCX file.' }))
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((current) => ({ ...current, contractFile: 'Contract files must be smaller than 5 MB.' }))
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
      setFieldErrors((current) => {
        const next = { ...current }
        delete next.contractFile
        return next
      })
    }
    reader.readAsDataURL(file)
  }

  const removeContract = () => {
    setEmployee((current) => ({ ...current, contractFile: null }))
    if (fileInput.current) fileInput.current.value = ''
  }

  const addCategory = (event) => {
    // categories are shared by all employee records in local storage
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
    // unassigns employees before removing a category to avoid stale references
    const assignedCount = employees.filter((record) => record.category === name).length
    const assignedWarning = assignedCount
      ? ` ${assignedCount} ${assignedCount === 1 ? 'employee will' : 'employees will'} be moved to no category.`
      : ''
    if (!window.confirm(`Delete the "${name}" category?${assignedWarning}`)) return

    setCategories((current) => current.filter((category) => category !== name))
    setEmployees((current) => current.map((record) => (
      record.category === name ? { ...record, category: '' } : record
    )))
  }

  const saveEmployee = () => {
    // validates required payroll and profile values before creating or updating a record
    const errors = {}
    if (employee.firstName.trim().length < 2) {
      errors.firstName = 'First name must contain at least 2 characters.'
    }
    if (employee.lastName.trim().length < 2) {
      errors.lastName = 'Last name must contain at least 2 characters.'
    }
    if (!employee.email.trim() || !emailPattern.test(employee.email.trim())) {
      errors.email = 'Enter a valid email address, such as name@example.com.'
    }
    if (employee.phone && !isValidNZPhone(employee.phone)) {
      errors.phone = 'Enter a valid New Zealand phone number.'
    }
    if (employee.emergencyContactPhone && !isValidNZPhone(employee.emergencyContactPhone)) {
      errors.emergencyContactPhone = 'Enter a valid New Zealand phone number.'
    }
    if (!employee.category) {
      errors.category = 'Select or create an employee category.'
    }
    if (!employee.hourlyRate || Number(employee.hourlyRate) < minimumHourlyRate) {
      errors.hourlyRate = `Hourly pay rate must be at least NZ$${minimumHourlyRate.toFixed(2)} per hour.`
    }
    if (!employee.taxCode) {
      errors.taxCode = 'Select a tax code.'
    }
    if (!employee.kiwisaverRate) {
      errors.kiwisaverRate = 'Select a KiwiSaver rate or "Not enrolled".'
    }
    if (employee.irdNumber) {
      const irdDigits = employee.irdNumber.replace(/\D/g, '')
      if (irdDigits.length !== 8 && irdDigits.length !== 9) {
        errors.irdNumber = 'IRD number must contain 8 or 9 digits.'
      }
    }
    const timeInMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number)
      return (hours * 60) + minutes
    }
    const invalidAvailability = days.find((day) => {
      const schedule = employee.availability[day]
      return schedule.available && (
        !schedule.start
        || !schedule.end
        || timeInMinutes(schedule.end) <= timeInMinutes(schedule.start)
      )
    })
    if (invalidAvailability) {
      errors.availability = `${invalidAvailability} must have an end time after its start time.`
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      return
    }

    const record = {
      ...employee,
      id: selectedId || Date.now(),
      firstName: formatName(employee.firstName.trim()),
      lastName: formatName(employee.lastName.trim()),
      email: employee.email.trim().toLowerCase(),
      phone: formatNZPhone(employee.phone),
      emergencyContactName: formatName(employee.emergencyContactName.trim()),
      emergencyContactPhone: formatNZPhone(employee.emergencyContactPhone),
      irdNumber: formatIRDNumber(employee.irdNumber),
    }

    setEmployees((current) => (
      selectedId
        ? current.map((item) => (item.id === selectedId ? record : item))
        : [...current, record]
    ))
    setSelectedId(record.id)
    setEmployee(record)
    setSaved(true)
    setIsEditing(false)
    setFieldErrors({})
  }

  const deleteEmployee = () => {
    // returns to a blank form after removing the selected record
    if (!selectedId) return
    setEmployees((current) => current.filter((record) => record.id !== selectedId))
    startNewEmployee()
  }

  return (
    <div className="relative min-h-full overflow-x-hidden px-4 pb-8 pt-2 text-slate-900 sm:px-6 lg:px-8 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className={`${cardClass} flex flex-col gap-4 lg:flex-row lg:items-start`}>
          <div className="min-w-44">
            <h2 className="text-sm font-semibold">Employee categories</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">
              create groups to reuse across staff
            </p>
          </div>
          <div className="flex-1">
            <form onSubmit={addCategory} className="flex max-w-md gap-2">
              <input
                value={categoryName}
                onChange={(event) => {
                  setCategoryName(event.target.value)
                  setCategoryError('')
                }}
                placeholder="new category"
                className={inputClass}
              />
              <button type="submit" className="mt-1 cursor-pointer rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white">
                Add
              </button>
            </form>
            {categoryError && <p className="mt-2 text-xs text-red-600">{categoryError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <div key={category} className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-200">
                  <span>{category}</span>
                  <button
                    type="button"
                    onClick={() => removeCategory(category)}
                    className="cursor-pointer text-slate-400 transition hover:text-red-600"
                    aria-label={`Delete ${category} category`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {!categories.length && (
                <p className="text-xs text-slate-500 dark:text-slate-400">no categories created</p>
              )}
            </div>
          </div>
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
              <button
                type="button"
                onClick={startNewEmployee}
                className="cursor-pointer rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-600"
              >
                Add employee
              </button>
            </div>

            <div className="mt-4">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="search staff..."
                className={inputClass}
              />
            </div>

            <div className="mt-3 space-y-2">
              {filteredEmployees.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  onClick={() => selectEmployee(record)}
                  className={`w-full cursor-pointer rounded-lg border p-3 text-left transition ${
                    selectedId === record.id
                      ? 'border-sky-400 bg-sky-50 dark:border-sky-300/50 dark:bg-slate-900/50'
                      : 'border-sky-100 bg-white/40 hover:border-sky-300 dark:border-white/10 dark:bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{record.firstName} {record.lastName}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/70">{record.category || 'No category'}</p>
                </button>
              ))}
              {!filteredEmployees.length && (
                <p className="rounded-lg border border-dashed border-sky-200 px-3 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                  {employees.length ? 'no matching employees' : 'no employees yet'}
                </p>
              )}
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
                <div className="flex items-center gap-3">
                  {!isEditing ? (
                    <button type="button" onClick={() => setIsEditing(true)} className="cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">
                      Edit
                    </button>
                  ) : (
                    <button type="button" onClick={cancelEdit} className="cursor-pointer rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-sky-400 dark:border-white/15 dark:text-slate-300">
                      Cancel edit
                    </button>
                  )}
                  <button type="button" onClick={deleteEmployee} className="cursor-pointer text-sm font-semibold text-red-600 hover:text-red-700">
                    Delete employee
                  </button>
                </div>
              )}
            </div>

            {selectedId && !isEditing ? (
              <div className="mt-5 space-y-5">
                <section className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['First name', employee.firstName || 'Not set'],
                    ['Last name', employee.lastName || 'Not set'],
                    ['Email address', employee.email || 'Not set'],
                    ['Phone number', employee.phone || 'Not set'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-sky-100 bg-sky-50/40 px-4 py-3 dark:border-white/10 dark:bg-slate-950/20">
                      <p className={labelClass}>{label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </section>

                <section className={sectionClass}>
                  <h3 className="mb-4 text-sm font-semibold">Emergency contact</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      ['Contact name', employee.emergencyContactName || 'Not set'],
                      ['Contact phone', employee.emergencyContactPhone || 'Not set'],
                      ['Relationship', employee.emergencyContactRelationship || 'Not set'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className={labelClass}>{label}</p>
                        <p className="mt-1 text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={sectionClass}>
                  <h3 className="mb-4 text-sm font-semibold">Employment and payroll</h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ['Category', employee.category || 'Not set'],
                      ['Employment type', employee.employmentType || 'Not set'],
                      ['Hourly pay rate', employee.hourlyRate ? `NZ$${Number(employee.hourlyRate).toFixed(2)}/hr` : 'Not set'],
                      ['Minimum weekly hours', employee.employmentType === 'Casual' ? '0 hours (casual)' : `${Number(employee.minimumHours || 0)} hours`],
                      ['Tax code', employee.taxCode === 'ND' ? 'ND - Undefined tax code (45%)' : employee.taxCode],
                      ['KiwiSaver rate', employee.kiwisaverRate === 'Not enrolled' ? 'Not enrolled' : employee.kiwisaverRate ? `${employee.kiwisaverRate}%` : 'Not set'],
                      ['IRD number', employee.irdNumber || 'Not set'],
                      ['Start date', employee.startDate || 'Not set'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className={labelClass}>{label}</p>
                        <p className="mt-1 text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={sectionClass}>
                  <h3 className="mb-4 text-sm font-semibold">Contract</h3>
                  {employee.contractFile ? (
                    <a
                      href={employee.contractFile.dataUrl}
                      download={employee.contractFile.name}
                      className="cursor-pointer text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
                    >
                      {employee.contractFile.name}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No contract uploaded</p>
                  )}
                </section>

                <section className={sectionClass}>
                  <h3 className="mb-4 text-sm font-semibold">Availability</h3>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {days.map((day) => {
                      const schedule = employee.availability?.[day]
                      return (
                        <div key={day} className="rounded-lg border border-sky-100 px-3 py-3 dark:border-white/10">
                          <p className="text-xs font-semibold">{day}</p>
                          {schedule?.available ? (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {formatAvailabilityTime(schedule.start)} - {formatAvailabilityTime(schedule.end)}
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-slate-400">Unavailable</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            ) : (
            <>
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
                  {fieldError('firstName')}
                </label>
                <label>
                  <span className={labelClass}>Last name *</span>
                  <input className={inputClass} value={employee.lastName} onChange={updateEmployee('lastName')} />
                  {fieldError('lastName')}
                </label>
                <label>
                  <span className={labelClass}>Email address *</span>
                  <input type="email" className={inputClass} value={employee.email} onChange={updateEmployee('email')} />
                  {fieldError('email')}
                </label>
                <label>
                  <span className={labelClass}>Phone number</span>
                  <input
                    type="tel"
                    className={inputClass}
                    value={employee.phone}
                    onChange={updateEmployee('phone')}
                    onBlur={(event) => setEmployee((current) => ({ ...current, phone: formatNZPhone(event.target.value) }))}
                    placeholder="021 123 4567"
                  />
                  {fieldError('phone')}
                </label>
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Emergency contact</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <label>
                  <span className={labelClass}>Contact name</span>
                  <input className={inputClass} value={employee.emergencyContactName} onChange={updateEmployee('emergencyContactName')} />
                  {fieldError('emergencyContactName')}
                </label>
                <label>
                  <span className={labelClass}>Contact phone</span>
                  <input
                    type="tel"
                    className={inputClass}
                    value={employee.emergencyContactPhone}
                    onChange={updateEmployee('emergencyContactPhone')}
                    onBlur={(event) => setEmployee((current) => ({ ...current, emergencyContactPhone: formatNZPhone(event.target.value) }))}
                    placeholder="021 123 4567"
                  />
                  {fieldError('emergencyContactPhone')}
                </label>
                <label>
                  <span className={labelClass}>Relationship</span>
                  <input className={inputClass} value={employee.emergencyContactRelationship} onChange={updateEmployee('emergencyContactRelationship')} placeholder="e.g. Parent, partner" />
                </label>
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Employment and payroll</h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label>
                  <span className={labelClass}>Category *</span>
                  <select className={clickableInputClass} value={employee.category} onChange={updateEmployee('category')}>
                    <option value="">Select category</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  {fieldError('category')}
                </label>
                <label>
                  <span className={labelClass}>Employment type</span>
                  <select className={clickableInputClass} value={employee.employmentType} onChange={updateEmployee('employmentType')}>
                    <option>Permanent</option>
                    <option>Casual</option>
                    <option>Fixed term</option>
                    <option>Part time</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Hourly pay rate (NZD) *</span>
                  <input type="number" min={minimumHourlyRate} step="0.01" className={inputClass} value={employee.hourlyRate} onChange={updateEmployee('hourlyRate')} placeholder="23.95" />
                  {fieldError('hourlyRate')}
                </label>
                <label>
                  <span className={labelClass}>Minimum weekly hours *</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    className={inputClass}
                    value={employee.employmentType === 'Casual' ? '0' : employee.minimumHours}
                    onChange={updateEmployee('minimumHours')}
                    disabled={employee.employmentType === 'Casual'}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span className={labelClass}>Tax code *</span>
                  <select className={clickableInputClass} value={employee.taxCode} onChange={updateEmployee('taxCode')}>
                    {taxCodes.map((code) => (
                      <option key={code} value={code}>
                        {code === 'ND' ? 'ND - Undefined tax code (45%)' : code}
                      </option>
                    ))}
                  </select>
                  {fieldError('taxCode')}
                </label>
                <label>
                  <span className={labelClass}>KiwiSaver rate *</span>
                  <select className={clickableInputClass} value={employee.kiwisaverRate} onChange={updateEmployee('kiwisaverRate')}>
                    <option value="Not enrolled">Not enrolled</option>
                    <option value="3">3%</option>
                    <option value="3.5">3.5%</option>
                    <option value="4">4%</option>
                    <option value="6">6%</option>
                    <option value="8">8%</option>
                    <option value="10">10%</option>
                  </select>
                  {fieldError('kiwisaverRate')}
                </label>
                <label>
                  <span className={labelClass}>IRD number</span>
                  <input
                    className={inputClass}
                    value={employee.irdNumber}
                    onChange={updateEmployee('irdNumber')}
                    onBlur={(event) => setEmployee((current) => ({ ...current, irdNumber: formatIRDNumber(event.target.value) }))}
                    placeholder="123-456-789"
                  />
                  {fieldError('irdNumber')}
                </label>
                <label>
                  <span className={labelClass}>Start date</span>
                  <input type="date" className={clickableInputClass} value={employee.startDate} onChange={updateEmployee('startDate')} />
                </label>
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Contract</h3>
              <div>
                <span className={labelClass}>Contract document</span>
                {employee.contractFile ? (
                  <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-sky-200 px-3 py-2 dark:border-white/15">
                    <a
                      href={employee.contractFile.dataUrl}
                      download={employee.contractFile.name}
                      className="cursor-pointer truncate text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
                    >
                      {employee.contractFile.name}
                    </a>
                    <button type="button" onClick={removeContract} className="cursor-pointer text-xs font-semibold text-red-600">
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleContractUpload}
                      className="mt-1 block w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-200 dark:file:bg-sky-300/15 dark:file:text-sky-200"
                    />
                    {fieldError('contractFile')}
                  </>
                )}
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 text-sm font-semibold">Availability</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {days.map((day) => (
                  <div
                    key={day}
                    className={`rounded-lg border p-3 transition ${
                      employee.availability[day]?.available
                        ? 'border-sky-400 bg-sky-50/70 dark:border-sky-300/50 dark:bg-sky-300/10'
                        : 'border-slate-200 bg-slate-50/40 dark:border-white/10 dark:bg-slate-950/20'
                    }`}
                  >
                    <label className="flex cursor-pointer items-center justify-between text-xs font-semibold">
                      <span>{day.slice(0, 3)}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(employee.availability[day]?.available)}
                        onChange={() => toggleAvailability(day)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                      />
                    </label>
                    {employee.availability[day]?.available && (
                      <div className="mt-3 grid gap-2">
                        <label>
                          <span className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">From</span>
                          <select
                            value={employee.availability[day].start}
                            onChange={updateAvailabilityTime(day, 'start')}
                            className="mt-1 w-full cursor-pointer rounded-md border border-sky-200 bg-white px-2 py-2 text-xs font-medium text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/15 dark:bg-slate-950/70 dark:text-white"
                            aria-label={`${day} availability start time`}
                          >
                            {timeOptions.map((time) => (
                              <option key={`start-${time.value}`} value={time.value}>{time.label}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">To</span>
                          <select
                            value={employee.availability[day].end}
                            onChange={updateAvailabilityTime(day, 'end')}
                            className="mt-1 w-full cursor-pointer rounded-md border border-sky-200 bg-white px-2 py-2 text-xs font-medium text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/15 dark:bg-slate-950/70 dark:text-white"
                            aria-label={`${day} availability end time`}
                          >
                            {timeOptions.map((time) => (
                              <option key={`end-${time.value}`} value={time.value}>{time.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {fieldError('availability')}
            </div>

            {(isEditing || !selectedId) && (
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-sky-100 pt-5 sm:flex-row sm:justify-end dark:border-white/10">
                {selectedId && (
                  <button type="button" onClick={cancelEdit} className="cursor-pointer rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-sky-400 dark:border-white/15 dark:text-slate-300">
                    Cancel
                  </button>
                )}
                <button type="button" onClick={saveEmployee} className="cursor-pointer rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-600">
                  {selectedId ? 'Save changes' : 'Save employee'}
                </button>
              </div>
            )}
            </>
            )}
          </article>
        </section>
      </div>
    </div>
  )
}

export default EmployeeManagement