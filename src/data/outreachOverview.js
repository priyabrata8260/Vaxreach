import { DATA_AS_OF, VACCINATION_SCHEDULE } from './syntheticChildren.js'

const referenceDate = new Date(`${DATA_AS_OF}T00:00:00Z`)
const upcomingCutoff = new Date(referenceDate)
upcomingCutoff.setUTCDate(upcomingCutoff.getUTCDate() + 30)

export function deriveOutreachData(children, tasks) {
  const followUpQueue = children.flatMap((child) => {
    const upcomingDoses = child.pendingDoses.filter(({ dueDate }) => {
      const date = new Date(`${dueDate}T00:00:00Z`)
      return date >= referenceDate && date <= upcomingCutoff
    })
    const isMigrated = child.migrationStatus === 'Migrated out'
    const isUnreachable = child.familyReachability === 'Unreachable'
    const isOverdue = child.overdueDoses.length > 0
    const reasons = [
      ...(isOverdue ? ['Overdue vaccination'] : []),
      ...(upcomingDoses.length ? ['Upcoming vaccination'] : []),
      ...(isMigrated ? ['Migrated family'] : []),
      ...(isUnreachable ? ['Unreachable family'] : []),
    ]
    if (reasons.length === 0) return []

    const oldestOverdue = [...child.overdueDoses].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    const nextUpcoming = [...upcomingDoses].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    const childTasks = tasks.filter((task) => task.childId === child.childId)
    const priority = isOverdue || isMigrated || isUnreachable ? 'High' : 'Medium'
    const reasonText = [
      ...(isOverdue ? [`${child.overdueDoses.length} dose${child.overdueDoses.length === 1 ? '' : 's'} overdue`] : []),
      ...(isUnreachable ? ['family unreachable'] : []),
      ...(isMigrated ? ['migration needs review'] : []),
      ...(!isOverdue && nextUpcoming ? [`${upcomingDoses.length} dose${upcomingDoses.length === 1 ? '' : 's'} due soon`] : []),
    ].join(' · ')

    return [{
      ...child,
      reasons,
      reasonText,
      priority,
      nextDose: oldestOverdue ?? nextUpcoming ?? null,
      nextDoseDate: oldestOverdue?.dueDate ?? nextUpcoming?.dueDate ?? null,
      overdueDays: oldestOverdue?.daysOverdue ?? 0,
      taskStatus: childTasks.some((task) => task.status === 'Open') ? 'Open' : childTasks.some((task) => task.status === 'Completed') ? 'Completed' : 'No task',
    }]
  }).sort((a, b) => {
    const priorityOrder = { High: 0, Medium: 1 }
    return priorityOrder[a.priority] - priorityOrder[b.priority] || b.overdueDays - a.overdueDays || a.name.localeCompare(b.name)
  })

  const localityStats = [...new Set(children.map((child) => child.locality))].map((locality) => {
    const localityChildren = children.filter((child) => child.locality === locality)
    const overdueChildren = localityChildren.filter((child) => child.overdueDoses.length > 0)
    const upcomingDoseCount = localityChildren.reduce((sum, child) => sum + child.pendingDoses.filter(({ dueDate }) => {
      const date = new Date(`${dueDate}T00:00:00Z`)
      return date >= referenceDate && date <= upcomingCutoff
    }).length, 0)
    return {
      locality,
      registeredChildren: localityChildren.length,
      overdueChildren: overdueChildren.length,
      overdueDoses: overdueChildren.reduce((sum, child) => sum + child.overdueDoses.length, 0),
      upcomingDoses: upcomingDoseCount,
      unreachableFamilies: localityChildren.filter((child) => child.familyReachability === 'Unreachable').length,
      migratedFamilies: localityChildren.filter((child) => child.migrationStatus === 'Migrated out').length,
    }
  })

  const completedTasks = tasks.filter((task) => task.status === 'Completed').length
  const openTasks = tasks.filter((task) => task.status === 'Open').length
  const upcomingDoseCount = children.reduce((sum, child) => sum + child.pendingDoses.filter(({ dueDate }) => {
    const date = new Date(`${dueDate}T00:00:00Z`)
    return date >= referenceDate && date <= upcomingCutoff
  }).length, 0)
  const overdueDoseCount = children.reduce((sum, child) => sum + child.overdueDoses.length, 0)

  return {
    followUpQueue,
    localityStats,
    stats: {
      highPriorityChildren: followUpQueue.filter((child) => child.priority === 'High').length,
      overdueChildren: children.filter((child) => child.overdueDoses.length > 0).length,
      overdueDoses: overdueDoseCount,
      upcomingDoses: upcomingDoseCount,
      migratedFamilies: children.filter((child) => child.migrationStatus === 'Migrated out').length,
      unreachableFamilies: children.filter((child) => child.familyReachability === 'Unreachable').length,
      openTasks,
      completedTasks,
      registeredChildren: children.length,
      scheduledDoseCount: children.length * VACCINATION_SCHEDULE.length,
    },
  }
}

export { DATA_AS_OF }
