/**
 * Role-Based Access Control (RBAC) — Admin Backend
 *
 * Defines admin roles, permissions, and the role-permission matrix
 * for the City Lord admin portal. Used by Server Actions to gate
 * sensitive operations behind the caller's assigned role.
 */

import { requireAdminSession } from './auth'

// ==============================================================
// Enums
// ==============================================================

export enum AdminRole {
  VIEWER = 'viewer',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  SUPER = 'super',
}

export enum AdminPermission {
  // Dashboard
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',

  // User management
  VIEW_USERS = 'VIEW_USERS',
  MANAGE_USERS = 'MANAGE_USERS',
  BAN_USERS = 'BAN_USERS',
  ADJUST_USER_RESOURCES = 'ADJUST_USER_RESOURCES',

  // Territory management
  VIEW_TERRITORIES = 'VIEW_TERRITORIES',
  MANAGE_TERRITORIES = 'MANAGE_TERRITORIES',
  RESET_TERRITORY_HP = 'RESET_TERRITORY_HP',
  TRANSFER_TERRITORY = 'TRANSFER_TERRITORY',
  DELETE_TERRITORY = 'DELETE_TERRITORY',

  // System
  VIEW_LOGS = 'VIEW_LOGS',
  MANAGE_FACTIONS = 'MANAGE_FACTIONS',
  MANAGE_BADGES = 'MANAGE_BADGES',
  MANAGE_BACKGROUNDS = 'MANAGE_BACKGROUNDS',
}

// ==============================================================
// Permission Matrix
// ==============================================================

const ROLE_PERMISSIONS: Record<AdminRole, Set<AdminPermission>> = {
  [AdminRole.VIEWER]: new Set([
    AdminPermission.VIEW_DASHBOARD,
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_TERRITORIES,
    AdminPermission.VIEW_LOGS,
  ]),

  [AdminRole.OPERATOR]: new Set([
    AdminPermission.VIEW_DASHBOARD,
    AdminPermission.VIEW_USERS,
    AdminPermission.MANAGE_USERS,
    AdminPermission.BAN_USERS,
    AdminPermission.VIEW_TERRITORIES,
    AdminPermission.MANAGE_TERRITORIES,
    AdminPermission.RESET_TERRITORY_HP,
    AdminPermission.VIEW_LOGS,
  ]),

  [AdminRole.ADMIN]: new Set([
    AdminPermission.VIEW_DASHBOARD,
    AdminPermission.VIEW_USERS,
    AdminPermission.MANAGE_USERS,
    AdminPermission.BAN_USERS,
    AdminPermission.ADJUST_USER_RESOURCES,
    AdminPermission.VIEW_TERRITORIES,
    AdminPermission.MANAGE_TERRITORIES,
    AdminPermission.RESET_TERRITORY_HP,
    AdminPermission.TRANSFER_TERRITORY,
    AdminPermission.DELETE_TERRITORY,
    AdminPermission.VIEW_LOGS,
    AdminPermission.MANAGE_FACTIONS,
    AdminPermission.MANAGE_BADGES,
    AdminPermission.MANAGE_BACKGROUNDS,
  ]),

  [AdminRole.SUPER]: new Set(Object.values(AdminPermission)),
}

// Role hierarchy: higher index = more privileged
const ROLE_HIERARCHY: AdminRole[] = [
  AdminRole.VIEWER,
  AdminRole.OPERATOR,
  AdminRole.ADMIN,
  AdminRole.SUPER,
]

// ==============================================================
// Helpers
// ==============================================================

/**
 * Returns true if `role` has the specified `permission`.
 */
export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

/**
 * Returns true if `role` is at least as privileged as `minRole`.
 */
export function hasMinRole(role: AdminRole, minRole: AdminRole): boolean {
  const roleIdx = ROLE_HIERARCHY.indexOf(role)
  const minIdx = ROLE_HIERARCHY.indexOf(minRole)
  return roleIdx >= minIdx
}

/**
 * Server Action guard: asserts the current session has the given permission.
 * Throws if unauthorized. Call at the top of any sensitive Server Action.
 *
 * @example
 *   await requirePermission(AdminPermission.DELETE_TERRITORY)
 */
export async function requirePermission(
  permission: AdminPermission,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionOverride?: { role?: string },
): Promise<void> {
  // If a session override is provided (for testing), use it;
  // otherwise fall back to the HMAC-validated session cookie.
  const session = sessionOverride ?? (await requireAdminSession())
  const role = (session as { role?: string })?.role as AdminRole | undefined

  if (!role || !hasPermission(role, permission)) {
    throw new Error(`Forbidden: requires permission '${permission}'`)
  }
}

/** All defined roles in ascending privilege order. */
export const ALL_ROLES = ROLE_HIERARCHY

/** All defined permissions as an array. */
export const ALL_PERMISSIONS = Object.values(AdminPermission)
