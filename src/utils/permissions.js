export const PROTOTYPE_USER = Object.freeze({ displayName: 'Prototype administrator', role: 'administrator' })

export const PERMISSIONS = Object.freeze({
  RECORD_VACCINATION: 'record_vaccination',
  MANAGE_ASSIGNMENTS: 'manage_assignments',
  MANAGE_OUTREACH: 'manage_outreach',
  UPDATE_ASSIGNED_TASKS: 'update_assigned_tasks',
})

export function hasPermission(permission, user = PROTOTYPE_USER) {
  if (!user) return false
  if (user.role === 'administrator' || user.role === 'admin') return Object.values(PERMISSIONS).includes(permission)
  if (user.role === 'asha_worker') return permission === PERMISSIONS.RECORD_VACCINATION || permission === PERMISSIONS.UPDATE_ASSIGNED_TASKS
  return false
}
