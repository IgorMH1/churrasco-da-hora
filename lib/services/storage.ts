// lib/services/storage.ts
/**
 * Clean Code Compatibility Barrel:
 * Re-exports domain models, constants, repositories, and services so all existing
 * entry points continue compiling seamlessly during incremental migration.
 */

export type {
  UserRole,
  UserStatus,
  UserAccount,
  CorporateIdentityInfo,
  UserExtendedMeta,
  CreateUserAccountDto,
  UpdateOwnProfileDto,
} from "../../models/user.model";

export type {
  ShiftPeriod,
  WorkModel,
  StaffType,
  StaffMember,
  RoleParameterRule,
  CalculatedShiftRate,
} from "../../models/staff.model";

export type { ClientRecord } from "../../models/client.model";

export type {
  EventStatus,
  EventRecord,
  CreateEventDto,
} from "../../models/event.model";

export type {
  BackupScope,
  BackupFormat,
  ApiOperationalState,
  BackupLogRecord,
  BackupSnapshotPayload,
  ApiHealthStatus,
  EmergencyMaintenanceState,
  SupabaseFullDataset,
} from "../../models/governance.model";

export {
  DEFAULT_ADMIN_USER,
  DEFAULT_ROLE_RULES,
} from "../../config/constants";

export { getSupabaseClient } from "../../repositories/supabase.client";

export {
  fetchAllFromSupabase,
  saveUsersToStorage,
  saveClientsToStorage,
  saveStaffToStorage,
  syncAllTablesFromUsersList,
  lockUserAccountByEmailInSupabase,
  getCurrentUserSession,
  setCurrentUserSession,
} from "../../repositories/user.repository";

export { saveEventsToStorage } from "../../repositories/event.repository";

export {
  insertBackupLogInSupabase,
  deleteBackupLogFromSupabase,
  getRoleParameterRulesFromStorage,
  saveRoleParameterRulesToStorage,
  saveBackupSnapshotToStorage,
  getLastBackupSnapshotFromStorage,
  getEmergencyMaintenanceState,
  saveEmergencyMaintenanceState,
  resetDatabaseToAdminOnly,
} from "../../repositories/governance.repository";

export { getCorporateIdentityInfo } from "../../services/corporateIdentity.service";

export {
  markIsoForFirstLogin,
  markIsoPasswordChanged,
  isFirstLoginPasswordChangeRequired,
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "../../services/auth.service";

export {
  findMatchingRoleRule,
  calculateShiftRateForEvent,
} from "../../services/shiftRate.service";

export {
  generateGoogleCalendarUrl,
  notifyClientOnEventConfirmation,
} from "../../services/eventSchedule.service";

export {
  restoreLastBackupSnapshot,
  activateEmergencyMaintenanceLock,
  deactivateEmergencyMaintenanceLock,
  checkAllApisHealth,
  buildBackupExportContent,
} from "../../services/governance.service";