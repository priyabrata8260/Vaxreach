import { ASHA_WORKER_ROSTER, DATA_AS_OF } from './syntheticChildren.js'

const referenceDate = new Date(`${DATA_AS_OF}T00:00:00Z`)
const upcomingCutoff = new Date(referenceDate)
upcomingCutoff.setUTCDate(upcomingCutoff.getUTCDate() + 30)

export function deriveAshaWorkers(children, tasks) {
  return ASHA_WORKER_ROSTER.map((worker) => {
    const assignedChildren = children.filter((child) => child.assignedAshaWorker === worker.name)
    const workerTasks = tasks.filter((task) => task.assignedTo === worker.name)
    const upcomingFollowUps = workerTasks.filter((task) => {
      if (task.status !== 'Open') return false
      const dueDate = new Date(`${task.dueDate}T00:00:00Z`)
      return dueDate >= referenceDate && dueDate <= upcomingCutoff
    })
    const localities = [...new Set(assignedChildren.map((child) => child.locality))].sort()

    return {
      ...worker,
      assignedChildren,
      localities,
      localityLabel: localities.length ? localities.join(', ') : 'No children assigned',
      assignedChildCount: assignedChildren.length,
      overdueChildCount: assignedChildren.filter((child) => child.overdueDoses.length > 0).length,
      upcomingFollowUpCount: upcomingFollowUps.length,
      unreachableFamilyCount: assignedChildren.filter((child) => child.familyReachability === 'Unreachable').length,
      migratedFamilyCount: assignedChildren.filter((child) => child.migrationStatus === 'Migrated out').length,
      openTaskCount: workerTasks.filter((task) => task.status === 'Open').length,
      completedTaskCount: workerTasks.filter((task) => task.status === 'Completed').length,
      tasks: workerTasks,
    }
  })
}
