// config/storageKeys.ts

/**
 * Centralized LocalStorage keys used for offline fallback and session persistence.
 */
export const STORAGE_KEYS = {
  USERS: "cdh_users_v1",
  EVENTS: "cdh_events_v1",
  CLIENTS: "cdh_clients_v1",
  STAFF: "cdh_staff_v1",
  BACKUP_LOGS: "cdh_backup_logs_v1",
  SESSION: "cdh_current_session_v1",
  RULES: "cdh_role_parameter_rules_v1",
  LAST_SNAPSHOT: "cdh_last_backup_snapshot_v1",
  EMERGENCY: "cdh_emergency_maintenance_v1",
  USER_EXT_META: "cdh_user_ext_meta_v1",
} as const;