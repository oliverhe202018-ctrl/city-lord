export enum AdminRole {
  VIEWER = 'viewer',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  SUPER = 'super',
}

export enum AdminPermission {
  // 查看权限
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_USERS = 'view_users',
  VIEW_TERRITORIES = 'view_territories',
  VIEW_CLUBS = 'view_clubs',
  VIEW_MISSIONS = 'view_missions',
  VIEW_LOGS = 'view_logs',

  // 用户管理权限
  MANAGE_USERS = 'manage_users',
  BAN_USERS = 'ban_users',
  ADJUST_USER_RESOURCES = 'adjust_user_resources',

  // 领地管理权限
  MANAGE_TERRITORIES = 'manage_territories',
  RESET_TERRITORY_HP = 'reset_territory_hp',
  TRANSFER_TERRITORY = 'transfer_territory',
  DELETE_TERRITORY = 'delete_territory',

  // 俱乐部管理权限
  AUDIT_CLUBS = 'audit_clubs',
  MANAGE_CLUBS = 'manage_clubs',

  // 其他管理权限
  MANAGE_MISSIONS = 'manage_missions',
  MANAGE_STORE = 'manage_store',
  MANAGE_BADGES = 'manage_badges',
  VIEW_ADMIN_LOGS = 'view_admin_logs',
}

export const PERMISSION_MATRIX: Record<AdminRole, AdminPermission[]> = {
  [AdminRole.VIEWER]: [
    AdminPermission.VIEW_DASHBOARD,
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_TERRITORIES,
    AdminPermission.VIEW_CLUBS,
    AdminPermission.VIEW_MISSIONS,
    AdminPermission.VIEW_LOGS,
  ],

  [AdminRole.OPERATOR]: [
    AdminPermission.VIEW_DASHBOARD,
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_TERRITORIES,
    AdminPermission.VIEW_CLUBS,
    AdminPermission.VIEW_MISSIONS,
    AdminPermission.VIEW_LOGS,
    AdminPermission.AUDIT_CLUBS,
    AdminPermission.RESET_TERRITORY_HP,
    AdminPermission.BAN_USERS,
  ],

  [AdminRole.ADMIN]: [
    AdminPermission.VIEW_DASHBOARD,
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_TERRITORIES,
    AdminPermission.VIEW_CLUBS,
    AdminPermission.VIEW_MISSIONS,
    AdminPermission.VIEW_LOGS,
    AdminPermission.MANAGE_USERS,
    AdminPermission.BAN_USERS,
    AdminPermission.ADJUST_USER_RESOURCES,
    AdminPermission.MANAGE_TERRITORIES,
    AdminPermission.RESET_TERRITORY_HP,
    AdminPermission.TRANSFER_TERRITORY,
    AdminPermission.AUDIT_CLUBS,
    AdminPermission.MANAGE_CLUBS,
    AdminPermission.MANAGE_MISSIONS,
    AdminPermission.MANAGE_STORE,
    AdminPermission.MANAGE_BADGES,
    AdminPermission.VIEW_ADMIN_LOGS,
  ],

  [AdminRole.SUPER]: Object.values(AdminPermission),
}

export function hasPermission(
  role: AdminRole,
  permission: AdminPermission
): boolean {
  const rolePermissions = PERMISSION_MATRIX[role] || []
  return rolePermissions.includes(permission)
}

export function hasAnyPermission(
  role: AdminRole,
  permissions: AdminPermission[]
): boolean {
  return permissions.some((perm) => hasPermission(role, perm))
}

export function hasAllPermissions(
  role: AdminRole,
  permissions: AdminPermission[]
): boolean {
  return permissions.every((perm) => hasPermission(role, perm))
}

export function getRolePermissions(role: AdminRole): AdminPermission[] {
  return PERMISSION_MATRIX[role] || []
}
