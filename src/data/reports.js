import { DATA_AS_OF, VACCINATION_SCHEDULE } from './syntheticChildren.js'

const dateOnly = (date) => date.toISOString().slice(0, 10)

export function getReportDateBounds(children) {
  const dueDates = children.flatMap((child) => VACCINATION_SCHEDULE.map((dose) => {
    const due = new Date(`${child.dateOfBirth}T00:00:00Z`)
    due.setUTCDate(due.getUTCDate() + dose.dueAfterDays)
    return dateOnly(due)
  }))
  return { min: dueDates.length ? dueDates.sort()[0] : DATA_AS_OF, max: DATA_AS_OF }
}

function doseStatus(entry, dueDate, reportEnd) {
  if (entry && entry.administeredDate <= reportEnd) return 'Completed'
  return dueDate < reportEnd ? 'Overdue' : 'Pending'
}

export function deriveReportsData(children, tasks, filters) {
  const { dateFrom, dateTo, locality, vaccine, ashaWorker, vaccinationStatus } = filters
  const validRange = Boolean(dateFrom && dateTo && dateFrom <= dateTo)
  const reportAsOf = dateTo > DATA_AS_OF ? DATA_AS_OF : dateTo
  const rawDoseEvents = validRange ? children.flatMap((child) => VACCINATION_SCHEDULE.map((dose) => {
    const due = new Date(`${child.dateOfBirth}T00:00:00Z`)
    due.setUTCDate(due.getUTCDate() + dose.dueAfterDays)
    const dueDate = dateOnly(due)
    const history = child.vaccinationHistory.find((entry) => entry.id === dose.id)
    const status = doseStatus(history, dueDate, reportAsOf)
    const completedByEnd = history && history.administeredDate <= reportAsOf
    const task = tasks.find((item) => item.childId === child.childId && item.status === 'Open')
    return {
      id: `${child.childId}-${dose.id}`, childId: child.childId, childName: child.name,
      locality: child.locality, assignedAshaWorker: child.assignedAshaWorker,
      doseId: dose.id, vaccine: dose.name, doseNumber: dose.doseNumber,
      dueDate, administeredDate: completedByEnd ? history.administeredDate : '',
      status, migrationStatus: child.migrationStatus,
      familyReachability: child.familyReachability, followUpStatus: child.followUpStatus,
      taskTitle: task?.title ?? '', taskDueDate: task?.dueDate ?? '', taskStatus: task?.status ?? 'No open task',
    }
  })) : []

  const eligibleDoseEvents = rawDoseEvents.filter((event) => event.dueDate >= dateFrom && event.dueDate <= dateTo
    && (!locality || event.locality === locality)
    && (!ashaWorker || event.assignedAshaWorker === ashaWorker)
    && (!vaccine || event.vaccine === vaccine))
  const visibleDoseEvents = eligibleDoseEvents.filter((event) => !vaccinationStatus || event.status === vaccinationStatus)
  const visibleChildIds = new Set(visibleDoseEvents.map(({ childId }) => childId))
  const eligibleChildren = children.filter((child) => visibleChildIds.has(child.childId))
  const visibleChildren = eligibleChildren
  const completedDoseCount = visibleDoseEvents.filter(({ status }) => status === 'Completed').length
  const coveragePercentage = visibleDoseEvents.length ? Math.round(completedDoseCount / visibleDoseEvents.length * 100) : 0
  const childCompletedByEnd = (child) => child.vaccinationHistory.filter((dose) => dose.administeredDate <= reportAsOf).length
  const fullyImmunised = eligibleChildren.filter((child) => childCompletedByEnd(child) >= VACCINATION_SCHEDULE.length).length
  const zeroDoseChildren = visibleChildren.filter((child) => childCompletedByEnd(child) === 0)
  const missedDoseEvents = visibleDoseEvents.filter(({ status }) => status === 'Overdue')

  const vaccineCoverage = VACCINATION_SCHEDULE.filter((dose) => !vaccine || dose.name === vaccine).map((dose) => {
    const doses = visibleDoseEvents.filter((event) => event.doseId === dose.id)
    const completed = doses.filter((event) => event.status === 'Completed').length
    return { id: dose.id, label: `${dose.name} · dose ${dose.doseNumber}`, total: doses.length, completed, coverage: doses.length ? Math.round(completed / doses.length * 100) : 0 }
  })
  const localityCoverage = [...new Set(visibleDoseEvents.map((event) => event.locality))].sort().map((name) => {
    const events = visibleDoseEvents.filter((event) => event.locality === name)
    const completed = events.filter((event) => event.status === 'Completed').length
    return { name, total: events.length, completed, coverage: events.length ? Math.round(completed / events.length * 100) : 0, overdue: events.filter((event) => event.status === 'Overdue').length }
  })
  const workerPerformance = [...new Set(visibleDoseEvents.map((event) => event.assignedAshaWorker))].sort().map((name) => {
    const events = visibleDoseEvents.filter((event) => event.assignedAshaWorker === name)
    const completed = events.filter((event) => event.status === 'Completed').length
    const workerChildren = eligibleChildren.filter((child) => child.assignedAshaWorker === name)
    return { id: name, name, assignedChildren: workerChildren.length, doses: events.length, completed, overdue: events.filter((event) => event.status === 'Overdue').length, coverage: events.length ? Math.round(completed / events.length * 100) : 0 }
  })
  const familyRecords = visibleChildren.filter((child) => child.migrationStatus === 'Migrated out' || child.familyReachability === 'Unreachable').map((child) => {
    const task = tasks.find((item) => item.childId === child.childId && item.status === 'Open')
    return { ...child, openTaskTitle: task?.title ?? 'No open follow-up', openTaskDueDate: task?.dueDate ?? '', openTaskStatus: task?.status ?? 'No open task' }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const start = new Date(`${dateFrom}T00:00:00Z`)
  const end = new Date(`${dateTo}T00:00:00Z`)
  const monthKeys = []
  const rangeStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const latestYearWindow = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1))
  const cursor = rangeStart > latestYearWindow ? rangeStart : latestYearWindow
  while (cursor <= end) {
    monthKeys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  const trendKeys = monthKeys
  const monthlyTrend = trendKeys.map((key) => {
    const [year, month] = key.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, 1))
    const count = visibleDoseEvents.filter((event) => event.status === 'Completed'
      && event.administeredDate >= dateFrom && event.administeredDate <= dateTo
      && event.administeredDate.startsWith(key)).length
    return { key, label: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date), count }
  })
  const missedDistribution = VACCINATION_SCHEDULE.filter((dose) => !vaccine || dose.name === vaccine).map((dose) => ({
    id: dose.id, label: `${dose.name} · dose ${dose.doseNumber}`,
    count: missedDoseEvents.filter((event) => event.doseId === dose.id).length,
  }))

  return {
    validRange, eligibleDoseEvents, visibleDoseEvents, eligibleChildren, visibleChildren,
    missedDoseEvents, zeroDoseChildren, fullyImmunised, completedDoseCount,
    coveragePercentage, vaccineCoverage, localityCoverage, workerPerformance,
    familyRecords, monthlyTrend, missedDistribution,
  }
}
