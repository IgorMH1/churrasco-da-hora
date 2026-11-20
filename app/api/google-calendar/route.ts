// app/api/google-calendar/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

function toIcsUtcTimestamp(dateStr: string, timeStr: string): string {
  // Converte data/hora de São Paulo (GMT-3) para formato iCalendar local
  const cleanDate = dateStr.replace(/-/g, "");
  const cleanTime = timeStr.replace(/:/g, "") + "00";
  return `${cleanDate}T${cleanTime}`;
}

function buildIcsContent(
  event: {
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
    supportTeam?: string[];
  },
  method: "REQUEST" | "CANCEL",
  organizerEmail: string
): string {
  const uid = `churrasco-evento-${event.id}@churrascodahora.com`;
  const dtStamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtStart = toIcsUtcTimestamp(event.eventDate, event.startTime);
  const dtEnd = toIcsUtcTimestamp(event.eventDate, event.endTime);
  const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  const sequence = method === "CANCEL" ? "1" : "0";
  const description = `Categoria: ${event.eventType}\\nQuantidade: ${
    event.honoreeName
  }\\nCliente: ${event.clientName}\\nResponsavel ADM: ${
    event.responsibleAdmin
  }\\nEquipe: ${(event.supportTeam || []).join(", ")}`;

  return [
    "BEGIN:VCALENDAR",
    "PRODID:-//Churrasco dos Da Hora//Agenda Automatica//PT",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VTIMEZONE",
    "TZID:America/Sao_Paulo",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:BRT",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=America/Sao_Paulo:${dtStart}`,
    `DTEND;TZID=America/Sao_Paulo:${dtEnd}`,
    `SUMMARY:${event.title} (${event.eventType})`,
    `DESCRIPTION:${description}`,
    "LOCATION:Espaco Churrasco dos Da Hora",
    `ORGANIZER;CN="Churrasco dos Da Hora":mailto:${organizerEmail}`,
    `ATTENDEE;CN="${event.clientName || "Agenda Da Hora"}";RSVP=FALSE:mailto:${organizerEmail}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function POST(request: Request) {
  try {
    const { event } = await request.json();

    if (!event || !event.id || !event.eventDate || !event.startTime || !event.endTime) {
      return NextResponse.json(
        { error: "Dados do evento incompletos para sincronizar na agenda." },
        { status: 400 }
      );
    }

    const gmailUser = (process.env.GMAIL_USER || "").trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
    const uid = `churrasco-evento-${event.id}@churrascodahora.com`;

    // Se o Gmail estiver configurado no .env.local, envia o evento iCalendar (.ics) direto para o Google Agenda
    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const icsContent = buildIcsContent(event, "REQUEST", gmailUser);
      const recipients = [gmailUser];
      if (event.clientEmail && event.clientEmail.includes("@")) {
        recipients.push(event.clientEmail.trim());
      }

      await transporter.sendMail({
        from: `"Agenda Churrasco dos Da Hora" <${gmailUser}>`,
        to: recipients.join(", "),
        subject: `📅 Evento Confirmado na Agenda: ${event.title} (${event.eventDate})`,
        text: `O evento "${event.title}" foi confirmado automaticamente na agenda para o dia ${event.eventDate} das ${event.startTime} às ${event.endTime}.`,
        icalEvent: {
          filename: "invite.ics",
          method: "request",
          content: icsContent,
        },
      });

      return NextResponse.json({
        ok: true,
        googleCalendarEventId: uid,
        syncedAtIso: new Date().toISOString(),
        mode: "gmail_ical_sync",
      });
    }

    return NextResponse.json({
      ok: true,
      googleCalendarEventId: uid,
      syncedAtIso: new Date().toISOString(),
      mode: "local_sync",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao sincronizar com o Google Agenda.";
    console.error("Erro Google Agenda POST:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { event, eventId, googleCalendarEventId } = await request.json();

    const gmailUser = (process.env.GMAIL_USER || "").trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

    if (gmailUser && gmailPass && event) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const icsCancelContent = buildIcsContent(event, "CANCEL", gmailUser);
      const recipients = [gmailUser];
      if (event.clientEmail && event.clientEmail.includes("@")) {
        recipients.push(event.clientEmail.trim());
      }

      await transporter.sendMail({
        from: `"Agenda Churrasco dos Da Hora" <${gmailUser}>`,
        to: recipients.join(", "),
        subject: `🗑️ Evento Cancelado e Removido da Agenda: ${event.title}`,
        text: `O evento "${event.title}" (${event.eventDate}) foi cancelado e removido automaticamente da agenda.`,
        icalEvent: {
          filename: "cancel.ics",
          method: "cancel",
          content: icsCancelContent,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      removedEventId: eventId || event?.id,
      removedGoogleCalendarId: googleCalendarEventId || null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao remover evento do Google Agenda.";
    console.error("Erro Google Agenda DELETE:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}