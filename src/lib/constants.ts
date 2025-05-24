
export const USER_ROLES = {
  ADMIN: 'admin',
  INSPECTOR: 'inspector',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const APP_NAME = "EC Manager";

export const SPECIAL_ADMIN_EMAIL = "gdompey@iauto.services";
