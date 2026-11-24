// repositories/event.repository.ts
import { STORAGE_KEYS } from "../config/storageKeys";
import { EventRecord } from "../models/event.model";
import { getSupabaseClient, writeLocalStorageJson } from "./supabase.client";

/**
 * Persists the event list to LocalStorage and upserts all records into Supabase.
 */
export async function saveEventsToStorage(events: EventRecord[]): Promise<void> {
  writeLocalStorageJson(STORAGE_KEYS.EVENTS, events);

  try {
    const supabase = getSupabaseClient();
    const rows = events.map((ev) => ({
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
    }));

    await supabase.from("events").upsert(rows, { onConflict: "id" });
  } catch (error) {
    console.error("Failed to synchronize events with Supabase:", error);
  }
}