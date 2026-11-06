export const APP_ROLES = Object.freeze({ ADMINISTRATOR: 'administrator', ASHA_WORKER: 'asha_worker' })

export function hasRoleAccess(role, allowedRoles) {
  return allowedRoles.includes(role)
}

export function dashboardPathForRole(role) {
  return role === APP_ROLES.ASHA_WORKER ? '/asha/dashboard' : '/admin/dashboard'
}

export function workspacePath(path, role, cloudEnabled) {
  if (!cloudEnabled) return path
  const prefix = role === APP_ROLES.ASHA_WORKER ? '/asha' : '/admin'
  return `${prefix}/${path.replace(/^\/+/, '')}`
}
