import { DATA_AS_OF, syntheticChildren, VACCINATION_SCHEDULE } from './syntheticChildren.js'

const AS_OF = new Date(`${DATA_AS_OF}T00:00:00Z`)
const UPCOMING_CUTOFF = new Date(AS_OF)
UPCOMING_CUTOFF.setUTCDate(UPCOMING_CUTOFF.getUTCDate() + 30)
const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))

export function deriveDashboardData(children = syntheticChildren) {
  const dashboardSummary = children.reduce((summary, child) => {
    summary.totalChildren += 1
    if (child.completedDoseCount >= VACCINATION_SCHEDULE.length) summary.fullyImmunised += 1
    else summary.partiallyImmunised += 1
    summary.overdueVaccinations += child.overdueDoses.length
    summary.upcomingVaccinations += child.pendingDoses.filter(({ dueDate }) => {
      const due = new Date(`${dueDate}T00:00:00Z`)
      return due >= AS_OF && due <= UPCOMING_CUTOFF
    }).length
    return summary
  }, { totalChildren: 0, fullyImmunised: 0, partiallyImmunised: 0, overdueVaccinations: 0, upcomingVaccinations: 0 })

  dashboardSummary.coveragePercentage = dashboardSummary.totalChildren
    ? Math.round((dashboardSummary.fullyImmunised / dashboardSummary.totalChildren) * 100)
    : 0

  const localityCoverage = [...new Set(children.map(({ locality }) => locality))].map((locality) => {
    const localityChildren = children.filter((child) => child.locality === locality)
    const fullyImmunised = localityChildren.filter((child) => child.completedDoseCount >= VACCINATION_SCHEDULE.length).length
    return { locality, total: localityChildren.length, fullyImmunised, coverage: Math.round((fullyImmunised / localityChildren.length) * 100) }
  })

  const allVaccinations = children.flatMap((child) => child.vaccinationHistory.map((dose) => ({
    id: `${child.childId}-${dose.id}`,
    childId: child.childId,
    child: child.name,
    locality: child.locality,
    vaccine: `${dose.name} ${dose.doseNumber}`,
    date: dose.administeredDate,
    dateLabel: formatDate(dose.administeredDate),
    ashaWorker: dose.administeredBy,
  })))

  const monthlyVaccinationTrend = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(AS_OF.getUTCFullYear(), AS_OF.getUTCMonth() - (5 - index), 1))
    const year = month.getUTCFullYear()
    const monthIndex = month.getUTCMonth()
    return {
      month: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(month),
      year,
      count: allVaccinations.filter(({ date }) => {
        const administered = new Date(`${date}T00:00:00Z`)
        return administered.getUTCFullYear() === year && administered.getUTCMonth() === monthIndex
      }).length,
    }
  })

  const recentVaccinationActivity = [...allVaccinations]
    .sort((a, b) => b.date.localeCompare(a.date) || a.child.localeCompare(b.child))
    .slice(0, 8)

  const immediateFollowUps = children
    .filter((child) => ['Immediate follow-up', 'Unreachable', 'Migrated'].includes(child.followUpStatus))
    .sort((a, b) => {
      const aOverdue = Math.max(0, ...a.overdueDoses.map(({ daysOverdue }) => daysOverdue))
      const bOverdue = Math.max(0, ...b.overdueDoses.map(({ daysOverdue }) => daysOverdue))
      return bOverdue - aOverdue || a.name.localeCompare(b.name)
    })
    .slice(0, 12)
    .map((child) => ({
      ...child,
      dueDateLabel: child.overdueDoses.length ? formatDate(child.overdueDoses[0].dueDate) : '—',
      overdueDoseNames: child.overdueDoses.map(({ name }) => name).join(', ') || 'Contact check',
    }))

  return { dashboardSummary, localityCoverage, monthlyVaccinationTrend, recentVaccinationActivity, immediateFollowUps }
}

export { DATA_AS_OF, VACCINATION_SCHEDULE }
