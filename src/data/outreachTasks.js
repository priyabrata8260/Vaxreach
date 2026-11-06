import { DATA_AS_OF } from './syntheticChildren.js'

export function createSyntheticOutreachTasks(children) {
  const reference = new Date(`${DATA_AS_OF}T00:00:00Z`)
  const cutoff = new Date(reference)
  cutoff.setUTCDate(cutoff.getUTCDate() + 30)

  return children.flatMap((child, index) => {
    const upcomingDose = child.pendingDoses
      .filter(({ dueDate }) => {
        const date = new Date(`${dueDate}T00:00:00Z`)
        return date >= reference && date <= cutoff
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]

    let task
    if (child.migrationStatus === 'Migrated out') {
      task = { title: 'Confirm migration and update service area', dueDate: DATA_AS_OF, taskType: 'Migration review', priority: 'High' }
    } else if (child.familyReachability === 'Unreachable') {
      task = { title: 'Attempt family contact', dueDate: DATA_AS_OF, taskType: 'Contact attempt', priority: 'High' }
    } else if (child.overdueDoses.length) {
      const earliestDue = [...child.overdueDoses].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
      task = { title: `Follow up on ${child.overdueDoses.length} overdue dose${child.overdueDoses.length === 1 ? '' : 's'}`, dueDate: earliestDue.dueDate, taskType: 'Overdue vaccination', priority: 'High' }
    } else if (upcomingDose) {
      task = { title: `Remind family: ${upcomingDose.name} dose ${upcomingDose.doseNumber}`, dueDate: upcomingDose.dueDate, taskType: 'Upcoming vaccination', priority: 'Normal' }
    }

    if (!task) return []
    const completed = index % 6 === 0
    return [{
      taskId: `TASK-${String(index + 1).padStart(4, '0')}`,
      childId: child.childId,
      ...task,
      assignedTo: child.assignedAshaWorker,
      status: completed ? 'Completed' : 'Open',
      createdAt: DATA_AS_OF,
      completedAt: completed ? DATA_AS_OF : null,
    }]
  })
}
