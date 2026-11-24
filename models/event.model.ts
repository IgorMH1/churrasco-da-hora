// models/event.model.ts

export type EventStatus = "CONFIRMADO" | "PENDENTE" | "CANCELADO";

export interface EventRecord {
  id: string;
  title: string;
  eventType: string;
  honoreeName: string; // Stores formatted guest count (e.g., "40 pessoas")
  clientName: string;
  clientEmail?: string;
  responsibleAdmin: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  googleCalendarEventId?: string;
  supportTeam: string[];
  confirmedStaff?: string[];
  notes?: string;
}

export interface CreateEventDto {
  title: string;
  eventType: string;
  guestCount: string;
  clientName: string;
  clientEmail?: string;
  responsibleAdmin: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  supportTeam: string[];
}