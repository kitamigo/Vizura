export const demoRosterStorageKey = 'vizura-demo-roster'
export const demoRosterChangedEvent = 'vizura-demo-roster-changed'

export const testEmployee = {
  id: 1,
  name: 'Alex Morgan',
  role: 'Test employee',
  color: '#2563eb',
}

export function getInitialDemoShifts() {
  const start = new Date()
  start.setHours(9, 0, 0, 0)
  return [{
    Id: 1,
    Subject: 'Test shift',
    StartTime: start,
    EndTime: new Date(start.getTime() + 8 * 60 * 60 * 1000),
    EmployeeId: testEmployee.id,
    RosterId: 1,
    IsPublished: false,
  }]
}

export function readDemoShifts() {
  const stored = localStorage.getItem(demoRosterStorageKey)
  if (!stored) return getInitialDemoShifts()

  try {
    return JSON.parse(stored).map((shift) => ({
      ...shift,
      StartTime: new Date(shift.StartTime),
      EndTime: new Date(shift.EndTime),
    }))
  } catch {
    return getInitialDemoShifts()
  }
}

export function writeDemoShifts(shifts) {
  localStorage.setItem(demoRosterStorageKey, JSON.stringify(shifts))
  window.dispatchEvent(new Event(demoRosterChangedEvent))
}
