// services/eventSchedule.service.ts
import { SCHEDULE_RULES } from "../config/constants";
import { EventRecord } from "../models/event.model";
import { UserAccount } from "../models/user.model";
import { sendEventConfirmationEmail } from "../repositories/email.repository";

/**
 * Builds a Google Calendar template URL pre-populated with event details in GMT-3.
 */
export function generateGoogleCalendarUrl(event: EventRecord): string {
  const cleanDate = (event.eventDate || "2026-11-20").replace(/-/g, "");
  const cleanStart = (event.startTime || "12:00").replace(/:/g, "") + "00";
  const cleanEnd = (event.endTime || "17:00").replace(/:/g, "") + "00";

  const datesParam = `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`;
  const textParam = encodeURIComponent(`${event.title} (${event.eventType})`);
  const detailsParam = encodeURIComponent(
    `Evento: ${event.title}\nCategoria: ${event.eventType}\nQuantidade: ${event.honoreeName}\nCliente: ${event.clientName}\nResponsável ADM: ${event.responsibleAdmin}\nEquipe: ${(event.supportTeam || []).join(", ")}`
  );
  const locationParam = encodeURIComponent("Espaço Churrasco dos Da Hora");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${textParam}&dates=${datesParam}&details=${detailsParam}&location=${locationParam}&ctz=${SCHEDULE_RULES.TIMEZONE_IANA}`;
}

/**
 * Resolves the client's email and dispatches the event confirmation email (Card #39).
 */
export async function notifyClientOnEventConfirmation(
  event: EventRecord,
  allUsers: UserAccount[]
): Promise<{ sent: boolean; email?: string; reason?: string }> {
  const matchedClient = allUsers.find(
    (u) =>
      (event.clientEmail &&
        u.email.toLowerCase() === event.clientEmail.toLowerCase()) ||
      u.name.trim().toLowerCase() === event.clientName.trim().toLowerCase()
  );

  const targetEmail = (event.clientEmail || matchedClient?.email || "").trim();
  if (!targetEmail || !targetEmail.includes("@")) {
    return { sent: false, reason: "Cliente sem e-mail vinculado." };
  }

  const dispatchResult = await sendEventConfirmationEmail({
    clientEmail: targetEmail,
    clientName: event.clientName,
    eventTitle: event.title,
    eventType: event.eventType,
    guestCount: event.honoreeName,
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    responsibleAdmin: event.responsibleAdmin,
    googleCalendarUrl: generateGoogleCalendarUrl(event),
  });

  if (!dispatchResult.ok) {
    return { sent: false, reason: dispatchResult.error };
  }

  return { sent: true, email: targetEmail };
}