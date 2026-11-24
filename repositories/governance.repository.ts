// repositories/governance.repository.ts
import { DEFAULT_ADMIN_USER, DEFAULT_ROLE_RULES } from "../config/constants";
import { STORAGE_KEYS } from "../config/storageKeys";
import { ClientRecord } from "../models/client.model";
import { EventRecord } from "../models/event.model";
import {
  BackupLogRecord,
  BackupSnapshotPayload,
  EmergencyMaintenanceState,
} from "../models/governance.model";
import { RoleParameterRule, StaffMember } from "../models/staff.model";
import { UserAccount } from "../models/user.model";
import {
  getSupabaseClient,
  readLocalStorageJson,
  removeLocalStorageItem,
  writeLocalStorageJson,
} from "./supabase.client";
import { saveUsersToStorage } from "./user.repository";

/**
 * Upserts a backup audit log record into Supabase.
 */
export async function insertBackupLogInSupabase(log: BackupLogRecord): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("backup_logs").upsert(
      [
        {
          id: log.id,
          scope: log.scope,
          format: log.format,
          exported_at_gmt3: log.exportedAtGmt3,
          exported_by: log.exportedBy,
        },
      ],
      { onConflict: "id" }
    );
  } catch (error) {
    console.error("Failed to insert backup log in Supabase:", error);
  }
}

/**
 * Deletes a backup audit log record from Supabase by ID.
 */
export async function deleteBackupLogFromSupabase(id: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("backup_logs").delete().eq("id", id);
  } catch (error) {
    console.error("Failed to delete backup log from Supabase:", error);
  }
}

/**
 * Reads role parameter rules (shift daily rates and work models) from storage (Card #41).
 */
export function getRoleParameterRulesFromStorage(): RoleParameterRule[] {
  const stored = readLocalStorageJson<RoleParameterRule[]>(
    STORAGE_KEYS.RULES,
    DEFAULT_ROLE_RULES
  );
  return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_ROLE_RULES;
}

/**
 * Saves role parameter rules to storage (Card #41).
 */
export function saveRoleParameterRulesToStorage(rules: RoleParameterRule[]): void {
  writeLocalStorageJson(STORAGE_KEYS.RULES, rules);
}

/**
 * Saves a complete dataset snapshot for 1-click backup restore (Card #44).
 */
export function saveBackupSnapshotToStorage(snapshot: BackupSnapshotPayload): void {
  writeLocalStorageJson(STORAGE_KEYS.LAST_SNAPSHOT, snapshot);
}

/**
 * Retrieves the most recent backup snapshot available for restore (Card #44).
 */
export function getLastBackupSnapshotFromStorage(): BackupSnapshotPayload | null {
  return readLocalStorageJson<BackupSnapshotPayload | null>(
    STORAGE_KEYS.LAST_SNAPSHOT,
    null
  );
}

/**
 * Reads the current Emergency / Maintenance Mode state (Card #45).
 */
export function getEmergencyMaintenanceState(): EmergencyMaintenanceState {
  return readLocalStorageJson<EmergencyMaintenanceState>(STORAGE_KEYS.EMERGENCY, {
    active: false,
    lockedUserIds: [],
  });
}

/**
 * Persists the Emergency / Maintenance Mode state (Card #45).
 */
export function saveEmergencyMaintenanceState(
  state: EmergencyMaintenanceState
): void {
  writeLocalStorageJson(STORAGE_KEYS.EMERGENCY, state);
}

/**
 * Resets all system tables in LocalStorage and Supabase back to the default Admin account.
 */
export async function resetDatabaseToAdminOnly(): Promise<{
  users: UserAccount[];
  events: EventRecord[];
  clients: ClientRecord[];
  staff: StaffMember[];
}> {
  const cleanUsers = [DEFAULT_ADMIN_USER];

  writeLocalStorageJson(STORAGE_KEYS.USERS, cleanUsers);
  writeLocalStorageJson(STORAGE_KEYS.EVENTS, []);
  writeLocalStorageJson(STORAGE_KEYS.CLIENTS, []);
  writeLocalStorageJson(STORAGE_KEYS.STAFF, []);
  writeLocalStorageJson(STORAGE_KEYS.BACKUP_LOGS, []);
  removeLocalStorageItem(STORAGE_KEYS.EMERGENCY);

  try {
    const supabase = getSupabaseClient();
    await Promise.all([
      supabase.from("events").delete().neq("id", "__none__"),
      supabase.from("clients").delete().neq("id", "__none__"),
      supabase.from("staff").delete().neq("id", "__none__"),
      supabase.from("backup_logs").delete().neq("id", "__none__"),
      supabase.from("users").delete().neq("id", DEFAULT_ADMIN_USER.id),
    ]);
    await saveUsersToStorage(cleanUsers);
  } catch (error) {
    console.error("Failed to reset tables in Supabase:", error);
  }

  return {
    users: cleanUsers,
    events: [],
    clients: [],
    staff: [],
  };
}