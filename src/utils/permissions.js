export const PROTOTYPE_USER = Object.freeze({ displayName: 'Prototype health worker', role: 'health_worker' })

export const PERMISSIONS = Object.freeze({ RECORD_VACCINATION: 'record_vaccination' })

export function hasPermission(permission, user = PROTOTYPE_USER) {
  return permission === PERMISSIONS.RECORD_VACCINATION && user.role === 'health_worker'
}
