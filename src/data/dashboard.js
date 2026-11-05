// All dashboard values come from this synthetic prototype dataset.
export const DASHBOARD_AS_OF = '2026-11-05'

export const DOSE_SCHEDULE = ['BCG', 'OPV 1', 'Pentavalent 1', 'Pentavalent 2', 'MR 1']

const syntheticChildren = [
  ['VR-1001', 'Aarav S.', 'North Ward', 13, 5, null, 'Meena S.'],
  ['VR-1002', 'Anaya K.', 'North Ward', 11, 4, '2026-11-12', 'Meena S.'],
  ['VR-1003', 'Ishaan R.', 'North Ward', 9, 3, '2026-10-05', 'Rupa D.'],
  ['VR-1004', 'Myra P.', 'North Ward', 7, 5, null, 'Rupa D.'],
  ['VR-1005', 'Kabir N.', 'North Ward', 5, 2, '2026-12-18', 'Meena S.'],
  ['VR-1006', 'Zoya M.', 'River Side', 14, 5, null, 'Asha P.'],
  ['VR-1007', 'Vivaan T.', 'River Side', 12, 4, '2026-10-19', 'Asha P.'],
  ['VR-1008', 'Sara A.', 'River Side', 8, 3, '2026-11-14', 'Lata D.'],
  ['VR-1009', 'Reyansh G.', 'River Side', 6, 5, null, 'Lata D.'],
  ['VR-1010', 'Kiara B.', 'East Colony', 16, 5, null, 'Rekha B.'],
  ['VR-1011', 'Advik J.', 'East Colony', 10, 3, '2026-10-28', 'Rekha B.'],
  ['VR-1012', 'Aadhya V.', 'East Colony', 8, 2, '2026-11-20', 'Meena S.'],
  ['VR-1013', 'Arjun C.', 'East Colony', 4, 1, '2026-12-10', 'Meena S.'],
  ['VR-1014', 'Diya R.', 'South Market', 15, 5, null, 'Lata D.'],
  ['VR-1015', 'Atharv P.', 'South Market', 12, 4, '2026-11-01', 'Lata D.'],
  ['VR-1016', 'Ira M.', 'South Market', 9, 3, '2026-11-29', 'Asha P.'],
  ['VR-1017', 'Rudra K.', 'South Market', 6, 2, '2026-12-22', 'Asha P.'],
  ['VR-1018', 'Anvi D.', 'Central Park', 13, 5, null, 'Rekha B.'],
  ['VR-1019', 'Vihaan L.', 'Central Park', 9, 3, '2026-11-04', 'Rekha B.'],
  ['VR-1020', 'Meher F.', 'Central Park', 5, 2, '2026-12-15', 'Meena S.'],
].map(([id, name, locality, ageMonths, completedDoses, nextDoseDate, ashaWorker], childIndex) => ({
  id,
  name,
  locality,
  ageMonths,
  completedDoses,
  requiredDoses: DOSE_SCHEDULE.length,
  nextDoseDate,
  ashaWorker,
  doseHistory: DOSE_SCHEDULE.slice(0, completedDoses).map((vaccine, doseIndex) => {
    const monthsAgo = completedDoses - doseIndex - 1 + (childIndex % 3)
    const current = new Date(`${DASHBOARD_AS_OF}T00:00:00Z`)
    const day = monthsAgo === 0 ? 1 + (childIndex % 5) : 6 + ((childIndex * 3 + doseIndex * 2) % 22)
    const administered = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - monthsAgo, day))
    return { vaccine, date: administered.toISOString().slice(0, 10), ashaWorker }
  }),
}))

const asOf = new Date(`${DASHBOARD_AS_OF}T00:00:00Z`)
const upcomingCutoff = new Date(asOf)
upcomingCutoff.setUTCDate(upcomingCutoff.getUTCDate() + 30)
const displayDate = (isoDate) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`))

export const dashboardChildren = syntheticChildren.map((child) => {
  const due = child.nextDoseDate ? new Date(`${child.nextDoseDate}T00:00:00Z`) : null
  const dueStatus = !due ? 'Up to date' : due < asOf ? 'Overdue' : due <= upcomingCutoff ? 'Upcoming' : 'Scheduled'
  return { ...child, dueStatus, dueDateLabel: child.nextDoseDate ? displayDate(child.nextDoseDate) : '—' }
})

const allDoses = dashboardChildren.flatMap((child) => child.doseHistory.map((dose, doseIndex) => ({
  id: `${child.id}-${doseIndex + 1}`,
  childId: child.id,
  child: child.name,
  locality: child.locality,
  vaccine: dose.vaccine,
  date: dose.date,
  dateLabel: displayDate(dose.date),
  ashaWorker: dose.ashaWorker,
})))

export const dashboardSummary = dashboardChildren.reduce((summary, child) => {
  summary.totalChildren += 1
  if (child.completedDoses >= child.requiredDoses) summary.fullyImmunised += 1
  else summary.partiallyImmunised += 1
  if (child.dueStatus === 'Overdue') summary.overdueVaccinations += 1
  if (child.dueStatus === 'Upcoming') summary.upcomingVaccinations += 1
  return summary
}, { totalChildren: 0, fullyImmunised: 0, partiallyImmunised: 0, overdueVaccinations: 0, upcomingVaccinations: 0 })

dashboardSummary.coveragePercentage = dashboardSummary.totalChildren
  ? Math.round((dashboardSummary.fullyImmunised / dashboardSummary.totalChildren) * 100)
  : 0

export const localityCoverage = [...new Set(dashboardChildren.map((child) => child.locality))].map((locality) => {
  const children = dashboardChildren.filter((child) => child.locality === locality)
  const fullyImmunised = children.filter((child) => child.completedDoses >= child.requiredDoses).length
  return { locality, total: children.length, fullyImmunised, coverage: Math.round((fullyImmunised / children.length) * 100) }
})

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
export const monthlyVaccinationTrend = Array.from({ length: 6 }, (_, index) => {
  const month = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - (5 - index), 1))
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const count = allDoses.filter((dose) => {
    const date = new Date(`${dose.date}T00:00:00Z`)
    return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex
  }).length
  return { month: monthFormatter.format(month), year, count }
})

export const recentVaccinationActivity = [...allDoses]
  .sort((a, b) => b.date.localeCompare(a.date) || a.child.localeCompare(b.child))
  .slice(0, 6)

export const immediateFollowUps = dashboardChildren
  .filter((child) => child.dueStatus === 'Overdue')
  .sort((a, b) => a.nextDoseDate.localeCompare(b.nextDoseDate))
  .map((child) => ({ ...child, overdueDays: Math.floor((asOf - new Date(`${child.nextDoseDate}T00:00:00Z`)) / 86400000) }))
