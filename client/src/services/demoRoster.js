export const demoRosterStorageKey = 'vizura-demo-roster'
export const demoRosterChangedEvent = 'vizura-demo-roster-changed'
export const excludedDemoEmployeeId = '1'

export const testEmployee = {
  id: 1,
  name: 'Alex Morgan',
  role: 'Test employee',
  color: '#2563eb',
}

export function getInitialDemoShifts() {
  return []
}

export function readDemoShifts() {
  const stored = localStorage.getItem(demoRosterStorageKey)
  if (!stored) return getInitialDemoShifts()

  try {
    return JSON.parse(stored)
      .filter((shift) => String(shift.EmployeeId) !== excludedDemoEmployeeId)
      .map((shift) => ({
      ...shift,
      StartTime: new Date(shift.StartTime),
      EndTime: new Date(shift.EndTime),
      }))
  } catch {
    return getInitialDemoShifts()
  }
}

export function writeDemoShifts(shifts) {
  const activeShifts = shifts.filter((shift) => String(shift.EmployeeId) !== excludedDemoEmployeeId)
  localStorage.setItem(demoRosterStorageKey, JSON.stringify(activeShifts))
  window.dispatchEvent(new Event(demoRosterChangedEvent))
}
