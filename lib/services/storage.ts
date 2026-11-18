// src/lib/services/storage.ts
// Camada de Persistência Integrada ao Supabase (PostgreSQL Cloud) + Cache Local

import { supabase } from "./supabase";

export type UserRole = "ADM" | "EQUIPE_INTERNA" | "EQUIPE_EXTERNA" | "CLIENTE";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  cpfCnpj?: string;
  password: string;
  role: UserRole;
  specialty?: string;
  companyName?: string;
  dailyRate?: number;
  status: "ATIVO" | "INATIVO";
  passwordChangedAtIso: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  staffType: "INTERNA" | "EXTERNA_TERCEIRO";
  specialty: string;
  companyName?: string;
  dailyRate: number;
  status: "ATIVO" | "INATIVO";
  passwordChangedAtIso: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  cpfCnpj?: string;
  status: "ATIVO" | "INATIVO";
  passwordChangedAtIso: string;
}

export interface EventRecord {
  id: string;
  title: string;
  eventType: string;
  honoreeName: string;
  clientName: string;
  clientEmail?: string;
  responsibleAdmin: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: "PENDENTE" | "CONFIRMADO" | "CANCELADO" | "CONCLUIDO";
  googleCalendarEventId?: string;
  supportTeam: string[];
  confirmedStaff?: string[];
  notes?: string;
}

export interface BackupLogRecord {
  id: string;
  scope: "Usuários" | "Eventos" | "Completo";
  format: "JSON" | "SQL";
  exportedAtGmt3: string;
  exportedBy: string;
}

const KEYS = {
  USERS: "churrasco_db_users_v2",
  CURRENT_USER: "churrasco_current_user_v2",
  EVENTS: "churrasco_db_events_v2",
  CLIENTS: "churrasco_db_clients_v2",
  STAFF: "churrasco_db_staff_v2",
  BACKUPS: "churrasco_db_backups_v2",
};

export const DEFAULT_ADMIN_USER: UserAccount = {
  id: "ADM-0001",
  name: "Administrador Da Hora",
  email: "adm@churrascodahora.com.br",
  phoneAnatel: "(11) 99999-9999",
  password: "DaHora@2026",
  role: "ADM",
  specialty: "Gestão Geral Familiar",
  status: "ATIVO",
  passwordChangedAtIso: "2026-11-17T00:00:00-03:00",
};

// Mapeadores entre o formato da tabela PostgreSQL (snake_case) e o TypeScript (camelCase)
function mapRowToUser(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    email: String(row.email || "").toLowerCase(),
    phoneAnatel: String(row.phone_anatel || ""),
    cpfCnpj: row.cpf_cnpj ? String(row.cpf_cnpj) : undefined,
    password: String(row.password || ""),
    role: (row.role as UserRole) || "CLIENTE",
    specialty: row.specialty ? String(row.specialty) : undefined,
    companyName: row.company_name ? String(row.company_name) : undefined,
    dailyRate: Number(row.daily_rate || 0),
    status: (row.status as "ATIVO" | "INATIVO") || "ATIVO",
    passwordChangedAtIso: row.password_changed_at_iso
      ? String(row.password_changed_at_iso)
      : new Date().toISOString(),
  };
}

function mapUserToRow(u: UserAccount) {
  return {
    id: u.id,
    name: u.name,
    email: u.email.trim().toLowerCase(),
    phone_anatel: u.phoneAnatel,
    cpf_cnpj: u.cpfCnpj || null,
    password: u.password,
    role: u.role,
    specialty: u.specialty || null,
    company_name: u.companyName || null,
    daily_rate: u.dailyRate || 0,
    status: u.status || "ATIVO",
    password_changed_at_iso: u.passwordChangedAtIso || new Date().toISOString(),
  };
}

function mapRowToEvent(row: Record<string, unknown>): EventRecord {
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    eventType: String(row.event_type || "Evento"),
    honoreeName: String(row.honoree_name || ""),
    clientName: String(row.client_name || ""),
    clientEmail: row.client_email ? String(row.client_email) : undefined,
    responsibleAdmin: String(row.responsible_admin || "ADM a confirmar"),
    eventDate: String(row.event_date || ""),
    startTime: String(row.start_time || "12:00"),
    endTime: String(row.end_time || "18:00"),
    status: (row.status as EventRecord["status"]) || "PENDENTE",
    googleCalendarEventId: row.google_calendar_event_id
      ? String(row.google_calendar_event_id)
      : undefined,
    supportTeam: Array.isArray(row.support_team) ? (row.support_team as string[]) : [],
    confirmedStaff: Array.isArray(row.confirmed_staff) ? (row.confirmed_staff as string[]) : [],
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function mapEventToRow(ev: EventRecord) {
  return {
    id: ev.id,
    title: ev.title,
    event_type: ev.eventType,
    honoree_name: ev.honoreeName,
    client_name: ev.clientName,
    client_email: ev.clientEmail || null,
    responsible_admin: ev.responsibleAdmin,
    event_date: ev.eventDate,
    start_time: ev.startTime,
    end_time: ev.endTime,
    status: ev.status,
    google_calendar_event_id: ev.googleCalendarEventId || null,
    support_team: ev.supportTeam || [],
    confirmed_staff: ev.confirmedStaff || [],
    notes: ev.notes || null,
  };
}

function deriveStaffAndClients(users: UserAccount[]) {
  const staff: StaffMember[] = users
    .filter((u) => u.role === "EQUIPE_INTERNA" || u.role === "EQUIPE_EXTERNA")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phoneAnatel: u.phoneAnatel,
      staffType: u.role === "EQUIPE_INTERNA" ? "INTERNA" : "EXTERNA_TERCEIRO",
      specialty: u.specialty || (u.role === "EQUIPE_INTERNA" ? "Apoio Familiar" : "Terceirizado"),
      companyName: u.companyName || (u.role === "EQUIPE_INTERNA" ? "Família Da Hora" : "Prestador MEI"),
      dailyRate: u.dailyRate || 0,
      status: u.status,
      passwordChangedAtIso: u.passwordChangedAtIso,
    }));

  const clients: ClientRecord[] = users
    .filter((u) => u.role === "CLIENTE")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phoneAnatel: u.phoneAnatel,
      cpfCnpj: u.cpfCnpj,
      status: u.status,
      passwordChangedAtIso: u.passwordChangedAtIso,
    }));

  return { staff, clients };
}

// Busca todos os dados diretamente do Supabase e atualiza o cache local
export async function fetchAllFromSupabase() {
  try {
    const [usersRes, eventsRes, backupsRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("event_date", { ascending: true }),
      supabase.from("backup_logs").select("*").order("created_at", { ascending: false }),
    ]);

    const users: UserAccount[] =
      usersRes.data && usersRes.data.length > 0
        ? usersRes.data.map((r) => mapRowToUser(r as Record<string, unknown>))
        : [DEFAULT_ADMIN_USER];

    const events: EventRecord[] =
      eventsRes.data ? eventsRes.data.map((r) => mapRowToEvent(r as Record<string, unknown>)) : [];

    const backupLogs: BackupLogRecord[] =
      backupsRes.data
        ? backupsRes.data.map((r: Record<string, unknown>) => ({
            id: String(r.id || ""),
            scope: (r.scope as BackupLogRecord["scope"]) || "Completo",
            format: (r.format as BackupLogRecord["format"]) || "JSON",
            exportedAtGmt3: String(r.exported_at_gmt3 || ""),
            exportedBy: String(r.exported_by || "Administrador Da Hora"),
          }))
        : [];

    const { staff, clients } = deriveStaffAndClients(users);

    if (typeof window !== "undefined") {
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
      localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
      localStorage.setItem(KEYS.STAFF, JSON.stringify(staff));
      localStorage.setItem(KEYS.BACKUPS, JSON.stringify(backupLogs));
    }

    return { users, events, clients, staff, backupLogs, syncedWithCloud: !usersRes.error };
  } catch {
    const fallback = loadInitialData();
    return { ...fallback, backupLogs: [] as BackupLogRecord[], syncedWithCloud: false };
  }
}

export function loadInitialData() {
  const defaultUsers: UserAccount[] = [DEFAULT_ADMIN_USER];
  const defaultClients: ClientRecord[] = [];
  const defaultStaff: StaffMember[] = [];
  const defaultEvents: EventRecord[] = [];

  if (typeof window === "undefined") {
    return {
      users: defaultUsers,
      events: defaultEvents,
      clients: defaultClients,
      staff: defaultStaff,
    };
  }

  const savedUsers = localStorage.getItem(KEYS.USERS);
  const savedEvents = localStorage.getItem(KEYS.EVENTS);
  const savedClients = localStorage.getItem(KEYS.CLIENTS);
  const savedStaff = localStorage.getItem(KEYS.STAFF);

  const users: UserAccount[] = savedUsers ? JSON.parse(savedUsers) : defaultUsers;
  const events: EventRecord[] = savedEvents ? JSON.parse(savedEvents) : defaultEvents;
  const clients: ClientRecord[] = savedClients ? JSON.parse(savedClients) : defaultClients;
  const staff: StaffMember[] = savedStaff ? JSON.parse(savedStaff) : defaultStaff;

  return { users, events, clients, staff };
}

// Salva Usuários no Cache Local e faz UPSERT direto na tabela `public.users` do Supabase
export function saveUsersToStorage(users: UserAccount[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    const { staff, clients } = deriveStaffAndClients(users);
    localStorage.setItem(KEYS.STAFF, JSON.stringify(staff));
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
  }
  const rows = users.map(mapUserToRow);
  supabase
    .from("users")
    .upsert(rows, { onConflict: "id" })
    .then(({ error }) => {
      if (error) console.error("Erro ao sincronizar users no Supabase:", error.message);
    });
}

// Salva Eventos no Cache Local e faz UPSERT direto na tabela `public.events` do Supabase
export function saveEventsToStorage(events: EventRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
  }
  if (events.length > 0) {
    const rows = events.map(mapEventToRow);
    supabase
      .from("events")
      .upsert(rows, { onConflict: "id" })
      .then(({ error }) => {
        if (error) console.error("Erro ao sincronizar events no Supabase:", error.message);
      });
  }
}

export function saveClientsToStorage(clients: ClientRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
  }
}

export function saveStaffToStorage(staff: StaffMember[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.STAFF, JSON.stringify(staff));
  }
}

// Funções dedicadas para a tabela `public.backup_logs` no Supabase
export async function insertBackupLogInSupabase(log: BackupLogRecord) {
  await supabase.from("backup_logs").upsert({
    id: log.id,
    scope: log.scope,
    format: log.format,
    exported_at_gmt3: log.exportedAtGmt3,
    exported_by: log.exportedBy,
  });
}

export async function deleteBackupLogFromSupabase(id: string) {
  await supabase.from("backup_logs").delete().eq("id", id);
}

export function setCurrentUserSession(user: UserAccount | null) {
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  }
}

export function getCurrentUserSession(): UserAccount | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEYS.CURRENT_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserAccount;
  } catch {
    return null;
  }
}

export function generateGoogleCalendarUrl(ev: EventRecord): string {
  const cleanDate = ev.eventDate.replace(/-/g, "");
  const cleanStart = (ev.startTime || "12:00").replace(":", "") + "00";
  const cleanEnd = (ev.endTime || "18:00").replace(":", "") + "00";

  const title = encodeURIComponent(`[${ev.eventType}] ${ev.title} - Para: ${ev.honoreeName}`);
  const details = encodeURIComponent(
    `Evento: ${ev.title}\nCategoria: ${ev.eventType}\nPara quem é: ${ev.honoreeName}\nCliente: ${ev.clientName}\nResponsável ADM: ${ev.responsibleAdmin}\nEquipe Escalada: ${ev.supportTeam.join(", ")}\nStatus: ${ev.status}`
  );
  const location = encodeURIComponent("Espaço Churrasco dos Da Hora");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}&details=${details}&location=${location}&ctz=America/Sao_Paulo`;
}

// Limpa os eventos, backups e usuários no Supabase mantendo exclusivamente o login ADM padrão
export async function resetDatabaseToAdminOnly() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.USERS, JSON.stringify([DEFAULT_ADMIN_USER]));
    localStorage.setItem(KEYS.EVENTS, JSON.stringify([]));
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify([]));
    localStorage.setItem(KEYS.STAFF, JSON.stringify([]));
    localStorage.setItem(KEYS.BACKUPS, JSON.stringify([]));
  }

  try {
    await supabase.from("events").delete().neq("id", "___none___");
    await supabase.from("backup_logs").delete().neq("id", "___none___");
    await supabase.from("users").delete().neq("email", "adm@churrascodahora.com.br");
    await supabase.from("users").upsert([mapUserToRow(DEFAULT_ADMIN_USER)], { onConflict: "id" });
  } catch (err) {
    console.error("Erro ao resetar tabelas no Supabase:", err);
  }

  return {
    users: [DEFAULT_ADMIN_USER],
    events: [] as EventRecord[],
    clients: [] as ClientRecord[],
    staff: [] as StaffMember[],
  };
}