/**
 * Centralized Permission Configuration
 * Shared between Frontend and Backend
 */
export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  OPERATOR: "Operator",
  TRANSPORTER: "Transporter",
  SHIPPER_OPS: "Shipper Ops",
  SALES_PERSON: "Sales Person",
};

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    canEdit: ["description", "status", "assignee", "category", "sla"],
    canDelete: true,
    canManageUsers: true,
  },
  [ROLES.MANAGER]: {
    canEdit: ["description", "status", "assignee", "category", "sla"],
    canDelete: true,
    canManageUsers: false,
  },
  [ROLES.OPERATOR]: {
    canEdit: ["description", "status"],
    canDelete: false,
    canManageUsers: false,
  },
  [ROLES.TRANSPORTER]: {
    canEdit: [],
    canDelete: false,
    canManageUsers: false,
  },
  [ROLES.SHIPPER_OPS]: {
    canEdit: [],
    canDelete: false,
    canManageUsers: false,
  },
  [ROLES.SALES_PERSON]: {
    canEdit: [],
    canDelete: false,
    canManageUsers: false,
  },
};

/**
 * 1. Check for boolean actions (e.g., canDelete, canManageUsers)
 */
export const checkPermission = (role, action) => {
  return !!PERMISSIONS[role]?.[action];
};

/**
 * 2. Check for field-level edit permissions (e.g., 'sla', 'status', 'assignee')
 */
export const canEditField = (role, field) => {
  return PERMISSIONS[role]?.canEdit?.includes(field) ?? false;
};

/**
 * 3. Bulk check for array of fields (Useful for Middleware/Backend)
 */
export const canEditFields = (role, fields = []) => {
  return fields.every(field => PERMISSIONS[role]?.canEdit?.includes(field));
};