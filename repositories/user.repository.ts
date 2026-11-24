// repositories/user.repository.ts
import { DEFAULT_ADMIN_USER, FIRST_LOGIN_ISO_MARKERS } from "../config/constants";
import { STORAGE_KEYS } from "../config/storageKeys";
import { ClientRecord } from "../models/client.model";
import { EventRecord } from "../models/event.model";
import { BackupLogRecord, SupabaseFullDataset } from "../models/governance.model";
import { ShiftPeriod, StaffMember, WorkModel } from "../models/staff.model";
import { UserAccount, UserExtendedMeta, UserRole, UserStatus } from "../models/user.model";
import {
  isFirstLoginPasswordChangeRequired,
  markIsoForFirstLogin,
} from "../services/auth.service";
import { getCorporateIdentityInfo } from "../services/corporateIdentity.service";
import {
  getSupabaseClient,
  readLocalStorageJson,
  removeLocalStorageItem,
  writeLocalStorageJson,
} from "./supabase.client";

function getExtendedUserMetaMap(): Record<string, UserExtendedMeta> {
  return readLocalStorageJson<Record<string, UserExtendedMeta>>(
    STORAGE_KEYS.USER_EXT_META,
    {}
  );
}

function saveExtendedUserMetaMap(users: UserAccount[]): void {
  const currentMeta = getExtendedUserMetaMap();
  users.forEach((user) => {
    currentMeta[user.id] = {
      corporateId: user.corporateId || getCorporateIdentityInfo(user).corporateCode,
      rateDiurna: user.rateDiurna ?? user.dailyRate ?? 0,
      rateVespertina: user.rateVespertina ?? user.dailyRate ?? 0,
      rateNoturna: user.rateNoturna ?? user.dailyRate ?? 0,
      shiftPeriod: user.shiftPeriod || "INTEGRAL",
      workModel: user.workModel || "PRESENCIAL",
      mustChangePassword: isFirstLoginPasswordChangeRequired(user),
    };
  });
  writeLocalStorageJson(STORAGE_KEYS.USER_EXT_META, currentMeta);
}

/**
 * Fetches all core tables from Supabase with automatic LocalStorage offline fallback.
 */
export async function fetchAllFromSupabase(): Promise<SupabaseFullDataset> {
  const supabase = getSupabaseClient();
  const extMeta = getExtendedUserMetaMap();

  try {
    const [usersRes, eventsRes, clientsRes, staffRes, logsRes] = await Promise.all([
      supabase.from("users").select("*"),
      supabase.from("events").select("*"),
      supabase.from("clients").select("*"),
      supabase.from("staff").select("*"),
      supabase.from("backup_logs").select("*"),
    ]);

    const mappedUsers: UserAccount[] =
      usersRes.data && usersRes.data.length > 0
        ? usersRes.data.map((row: Record<string, unknown>) =>
            mapRowToUserAccount(row, extMeta)
          )
        : [DEFAULT_ADMIN_USER];

    if (!mappedUsers.some((user) => user.role === "ADM")) {
      mappedUsers.unshift(DEFAULT_ADMIN_USER);
    }

    const mappedEvents: EventRecord[] =
      eventsRes.data && eventsRes.data.length > 0
        ? eventsRes.data.map(mapRowToEventRecord)
        : [];

    const mappedClients: ClientRecord[] =
      clientsRes.data && clientsRes.data.length > 0
        ? clientsRes.data.map(mapRowToClientRecord)
        : [];

    const mappedStaff: StaffMember[] =
      staffRes.data && staffRes.data.length > 0
        ? staffRes.data.map((row: Record<string, unknown>) =>
            mapRowToStaffMember(row, extMeta)
          )
        : [];

    const mappedLogs: BackupLogRecord[] =
      logsRes.data && logsRes.data.length > 0
        ? logsRes.data.map(mapRowToBackupLogRecord)
        : [];

    writeLocalStorageJson(STORAGE_KEYS.USERS, mappedUsers);
    writeLocalStorageJson(STORAGE_KEYS.EVENTS, mappedEvents);
    writeLocalStorageJson(STORAGE_KEYS.CLIENTS, mappedClients);
    writeLocalStorageJson(STORAGE_KEYS.STAFF, mappedStaff);
    writeLocalStorageJson(STORAGE_KEYS.BACKUP_LOGS, mappedLogs);

    return {
      users: mappedUsers,
      events: mappedEvents,
      clients: mappedClients,
      staff: mappedStaff,
      backupLogs: mappedLogs,
    };
  } catch (error) {
    console.warn("Supabase unreachable, loading from LocalStorage fallback:", error);
    return {
      users: readLocalStorageJson(STORAGE_KEYS.USERS, [DEFAULT_ADMIN_USER]),
      events: readLocalStorageJson(STORAGE_KEYS.EVENTS, []),
      clients: readLocalStorageJson(STORAGE_KEYS.CLIENTS, []),
      staff: readLocalStorageJson(STORAGE_KEYS.STAFF, []),
      backupLogs: readLocalStorageJson(STORAGE_KEYS.BACKUP_LOGS, []),
    };
  }
}

function mapRowToUserAccount(
  row: Record<string, unknown>,
  extMeta: Record<string, UserExtendedMeta>
): UserAccount {
  const id = String(row.id || "");
  const role = (row.role as UserRole) || "CLIENTE";
  const status = (row.status as UserStatus) || "ATIVO";
  const specialty = row.specialty ? String(row.specialty) : undefined;
  const pwIso = String(row.password_changed_at_iso || new Date().toISOString());
  const meta = extMeta[id] || {};
  const dailyRate = Number(row.daily_rate || 0);

  return {
    id,
    corporateId:
      meta.corporateId ||
      getCorporateIdentityInfo({ id, role, status, specialty }).corporateCode,
    name: String(row.name || ""),
    email: String(row.email || ""),
    phoneAnatel: String(row.phone_anatel || ""),
    cpfCnpj: row.cpf_cnpj ? String(row.cpf_cnpj) : undefined,
    password: String(row.password || ""),
    role,
    specialty,
    companyName: row.company_name ? String(row.company_name) : undefined,
    dailyRate,
    rateDiurna: meta.rateDiurna ?? dailyRate,
    rateVespertina: meta.rateVespertina ?? dailyRate,
    rateNoturna: meta.rateNoturna ?? dailyRate,
    shiftPeriod: (meta.shiftPeriod as ShiftPeriod) || "INTEGRAL",
    workModel: (meta.workModel as WorkModel) || "PRESENCIAL",
    status,
    passwordChangedAtIso: pwIso,
    mustChangePassword:
      pwIso.endsWith(FIRST_LOGIN_ISO_MARKERS.REQUIRED_SUFFIX) ||
      Boolean(meta.mustChangePassword),
  };
}

function mapRowToEventRecord(row: Record<string, unknown>): EventRecord {
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    eventType: String(row.event_type || "Evento"),
    honoreeName: String(row.honoree_name || "30 pessoas"),
    clientName: String(row.client_name || ""),
    clientEmail: row.client_email ? String(row.client_email) : undefined,
    responsibleAdmin: String(row.responsible_admin || "Administrador Da Hora"),
    eventDate: String(row.event_date || ""),
    startTime: String(row.start_time || "12:00"),
    endTime: String(row.end_time || "17:00"),
    status: (row.status as EventRecord["status"]) || "PENDENTE",
    googleCalendarEventId: row.google_calendar_event_id
      ? String(row.google_calendar_event_id)
      : undefined,
    supportTeam: Array.isArray(row.support_team)
      ? (row.support_team as string[])
      : ["A definir pelo ADM"],
    confirmedStaff: Array.isArray(row.confirmed_staff)
      ? (row.confirmed_staff as string[])
      : [],
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function mapRowToClientRecord(row: Record<string, unknown>): ClientRecord {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    email: String(row.email || ""),
    phoneAnatel: String(row.phone_anatel || ""),
    cpfCnpj: row.cpf_cnpj ? String(row.cpf_cnpj) : undefined,
    status: (row.status as UserStatus) || "ATIVO",
    passwordChangedAtIso: String(
      row.password_changed_at_iso || new Date().toISOString()
    ),
  };
}

function mapRowToStaffMember(
  row: Record<string, unknown>,
  extMeta: Record<string, UserExtendedMeta>
): StaffMember {
  const id = String(row.id || "");
  const meta = extMeta[id] || {};
  const dailyRate = Number(row.daily_rate || 0);

  return {
    id,
    name: String(row.name || ""),
    email: String(row.email || ""),
    phoneAnatel: String(row.phone_anatel || ""),
    staffType: row.staff_type === "INTERNA" ? "INTERNA" : "EXTERNA_TERCEIRO",
    specialty: String(row.specialty || "Apoio"),
    companyName: row.company_name ? String(row.company_name) : undefined,
    dailyRate,
    rateDiurna: meta.rateDiurna ?? dailyRate,
    rateVespertina: meta.rateVespertina ?? dailyRate,
    rateNoturna: meta.rateNoturna ?? dailyRate,
    shiftPeriod: (meta.shiftPeriod as ShiftPeriod) || "INTEGRAL",
    workModel: (meta.workModel as WorkModel) || "PRESENCIAL",
    status: (row.status as UserStatus) || "ATIVO",
    passwordChangedAtIso: String(
      row.password_changed_at_iso || new Date().toISOString()
    ),
  };
}

function mapRowToBackupLogRecord(row: Record<string, unknown>): BackupLogRecord {
  return {
    id: String(row.id || ""),
    scope: (row.scope as BackupLogRecord["scope"]) || "Completo",
    format: (row.format as BackupLogRecord["format"]) || "JSON",
    exportedAtGmt3: String(row.exported_at_gmt3 || ""),
    exportedBy: String(row.exported_by || "Administrador Da Hora"),
  };
}

/**
 * Persists user accounts to LocalStorage and upserts them into Supabase.
 */
export async function saveUsersToStorage(users: UserAccount[]): Promise<void> {
  const normalizedUsers = users.map((user) => ({
    ...user,
    corporateId: user.corporateId || getCorporateIdentityInfo(user).corporateCode,
    passwordChangedAtIso: user.mustChangePassword
      ? markIsoForFirstLogin(user.passwordChangedAtIso)
      : user.passwordChangedAtIso,
  }));

  writeLocalStorageJson(STORAGE_KEYS.USERS, normalizedUsers);
  saveExtendedUserMetaMap(normalizedUsers);

  try {
    const supabase = getSupabaseClient();
    const rows = normalizedUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone_anatel: user.phoneAnatel,
      cpf_cnpj: user.cpfCnpj || null,
      password: user.password,
      role: user.role,
      specialty: user.specialty || null,
      company_name: user.companyName || null,
      daily_rate: user.dailyRate ?? user.rateDiurna ?? 0,
      status: user.status,
      password_changed_at_iso: user.passwordChangedAtIso,
    }));
    await supabase.from("users").upsert(rows, { onConflict: "id" });
  } catch (error) {
    console.error("Failed to synchronize users with Supabase:", error);
  }
}

/**
 * Persists client records to LocalStorage and upserts them into Supabase.
 */
export async function saveClientsToStorage(clients: ClientRecord[]): Promise<void> {
  writeLocalStorageJson(STORAGE_KEYS.CLIENTS, clients);

  try {
    const supabase = getSupabaseClient();
    const rows = clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone_anatel: client.phoneAnatel,
      cpf_cnpj: client.cpfCnpj || null,
      status: client.status,
      password_changed_at_iso: client.passwordChangedAtIso,
    }));
    await supabase.from("clients").upsert(rows, { onConflict: "id" });
  } catch (error) {
    console.error("Failed to synchronize clients with Supabase:", error);
  }
}

/**
 * Persists staff member records to LocalStorage and upserts them into Supabase.
 */
export async function saveStaffToStorage(staff: StaffMember[]): Promise<void> {
  writeLocalStorageJson(STORAGE_KEYS.STAFF, staff);

  try {
    const supabase = getSupabaseClient();
    const rows = staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone_anatel: member.phoneAnatel,
      staff_type: member.staffType,
      specialty: member.specialty,
      company_name: member.companyName || null,
      daily_rate: member.dailyRate || 0,
      status: member.status,
      password_changed_at_iso: member.passwordChangedAtIso,
    }));
    await supabase.from("staff").upsert(rows, { onConflict: "id" });
  } catch (error) {
    console.error("Failed to synchronize staff with Supabase:", error);
  }
}

/**
 * Derives and persists synchronized `staff` and `clients` tables from the master `users` list.
 */
export async function syncAllTablesFromUsersList(
  updatedUsers: UserAccount[]
): Promise<{ syncedStaff: StaffMember[]; syncedClients: ClientRecord[] }> {
  await saveUsersToStorage(updatedUsers);

  const syncedStaff: StaffMember[] = updatedUsers
    .filter((u) => u.role === "EQUIPE_INTERNA" || u.role === "EQUIPE_EXTERNA")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phoneAnatel: u.phoneAnatel,
      staffType: u.role === "EQUIPE_INTERNA" ? "INTERNA" : "EXTERNA_TERCEIRO",
      specialty:
        u.specialty || (u.role === "EQUIPE_INTERNA" ? "Apoio Familiar" : "Terceirizado"),
      companyName:
        u.companyName || (u.role === "EQUIPE_INTERNA" ? "Família Da Hora" : "Prestador MEI"),
      dailyRate: u.dailyRate ?? u.rateDiurna ?? 0,
      rateDiurna: u.rateDiurna ?? u.dailyRate ?? 0,
      rateVespertina: u.rateVespertina ?? u.dailyRate ?? 0,
      rateNoturna: u.rateNoturna ?? u.dailyRate ?? 0,
      shiftPeriod: u.shiftPeriod || "INTEGRAL",
      workModel: u.workModel || "PRESENCIAL",
      status: u.status,
      passwordChangedAtIso: u.passwordChangedAtIso,
    }));

  const syncedClients: ClientRecord[] = updatedUsers
    .filter((u) => u.role === "CLIENTE")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phoneAnatel: u.phoneAnatel,
      status: u.status,
      passwordChangedAtIso: u.passwordChangedAtIso,
    }));

  await Promise.all([
    saveStaffToStorage(syncedStaff),
    saveClientsToStorage(syncedClients),
  ]);

  return { syncedStaff, syncedClients };
}

/**
 * Marks a non-admin user account as BLOQUEADO in Supabase after exceeding login attempts (Card #46).
 */
export async function lockUserAccountByEmailInSupabase(
  email: string,
  allUsers: UserAccount[]
): Promise<UserAccount[]> {
  const normalizedEmail = email.trim().toLowerCase();
  const updatedUsers = allUsers.map((user) => {
    if (user.email.toLowerCase() === normalizedEmail && user.role !== "ADM") {
      return { ...user, status: "BLOQUEADO" as const };
    }
    return user;
  });

  await saveUsersToStorage(updatedUsers);
  return updatedUsers;
}

/**
 * Retrieves the currently authenticated user session from LocalStorage.
 */
export function getCurrentUserSession(): UserAccount | null {
  return readLocalStorageJson<UserAccount | null>(STORAGE_KEYS.SESSION, null);
}

/**
 * Sets or clears the currently authenticated user session in LocalStorage.
 */
export function setCurrentUserSession(user: UserAccount | null): void {
  if (!user) {
    removeLocalStorageItem(STORAGE_KEYS.SESSION);
    return;
  }
  writeLocalStorageJson(STORAGE_KEYS.SESSION, user);
}