// src/lib/services/storage.ts
// Gerenciador de Dados, Sessão Real de Login e Integração Google Calendar

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  cpfCnpj?: string;
  password: string;
  role: "ADM" | "CLIENTE";
  status?: "ATIVO" | "INATIVO";
  passwordChangedAtIso: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  phoneAnatel: string;
  staffType: "INTERNA" | "EXTERNA_TERCEIRO";
  specialty: string;
  companyName?: string;
  dailyRate: number;
  status?: "ATIVO" | "INATIVO";
  passwordChangedAtIso?: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  cpfCnpj?: string;
  status?: "ATIVO" | "INATIVO";
  passwordChangedAtIso?: string;
}

export interface EventRecord {
  id: string;
  title: string;
  eventType: string; // Aceita categoria em texto livre (Card #13)
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
  notes?: string;
}

const KEYS = {
  USERS: "churrasco_db_users_v2",
  CURRENT_USER: "churrasco_current_user_v2",
  EVENTS: "churrasco_db_events_v2",
  CLIENTS: "churrasco_db_clients_v2",
  STAFF: "churrasco_db_staff_v2",
};

export const DEFAULT_ADMIN_USER: UserAccount = {
  id: "ADM-0001",
  name: "Administrador Da Hora",
  email: "adm@churrascodahora.com.br",
  phoneAnatel: "(11) 99999-9999",
  password: "DaHora@2026",
  role: "ADM",
  status: "ATIVO",
  passwordChangedAtIso: "2026-11-17T00:00:00-03:00",
};

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

  if (!savedUsers) localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  if (!savedEvents) localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
  if (!savedClients) localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
  if (!savedStaff) localStorage.setItem(KEYS.STAFF, JSON.stringify(staff));

  return { users, events, clients, staff };
}

export function saveUsersToStorage(users: UserAccount[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  }
}

export function saveEventsToStorage(events: EventRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
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

// Gerenciamento da Sessão do Usuário Logado (Card #4)
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

// Gera Link Oficial de Agendamento no Google Calendar (Card #19)
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

export function resetDatabaseToAdminOnly() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.USERS, JSON.stringify([DEFAULT_ADMIN_USER]));
    localStorage.setItem(KEYS.EVENTS, JSON.stringify([]));
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify([]));
    localStorage.setItem(KEYS.STAFF, JSON.stringify([]));
  }
  return {
    users: [DEFAULT_ADMIN_USER],
    events: [] as EventRecord[],
    clients: [] as ClientRecord[],
    staff: [] as StaffMember[],
  };
}