// src/lib/services/storage.ts
// Banco de Dados Resetado: Apenas 1 Login ADM e listas vazias de Eventos, Clientes e Equipes

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  password: string;
  role: "ADM" | "CLIENTE";
  passwordChangedAtIso: string;
}

export interface StaffMember {
  id: string;
  name: string;
  phoneAnatel: string;
  staffType: "INTERNA" | "EXTERNA_TERCEIRO";
  specialty: string;
  companyName?: string;
  dailyRate: number;
}

export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
}

export interface EventRecord {
  id: string;
  title: string;
  eventType: "ANIVERSARIO" | "FESTA" | "FUTEBOL" | "CORPORATIVO";
  honoreeName: string;
  clientName: string;
  responsibleAdmin: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: "PENDENTE" | "CONFIRMADO" | "CANCELADO" | "CONCLUIDO";
  googleCalendarEventId?: string;
  supportTeam: string[];
}

// Chaves v2 limpas (ignoram e apagam os dados antigos de teste v1)
const KEYS = {
  USERS: "churrasco_db_users_v2",
  EVENTS: "churrasco_db_events_v2",
  CLIENTS: "churrasco_db_clients_v2",
  STAFF: "churrasco_db_staff_v2",
};

// Único login mantido no sistema após o reset
export const DEFAULT_ADMIN_USER: UserAccount = {
  id: "adm-1",
  name: "Administrador Da Hora",
  email: "adm@churrascodahora.com.br",
  phoneAnatel: "(11) 99999-9999",
  password: "DaHora@2026",
  role: "ADM",
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

  // Remove automaticamente os dados antigos da versão v1 do navegador
  localStorage.removeItem("churrasco_db_events_v1");
  localStorage.removeItem("churrasco_db_clients_v1");
  localStorage.removeItem("churrasco_db_staff_v1");

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

// Função para resetar tudo a qualquer momento deixando apenas o ADM
export function resetDatabaseToAdminOnly() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("churrasco_db_events_v1");
    localStorage.removeItem("churrasco_db_clients_v1");
    localStorage.removeItem("churrasco_db_staff_v1");

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