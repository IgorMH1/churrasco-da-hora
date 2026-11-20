// app/api/confirm-event-email/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const {
      clientEmail,
      clientName,
      eventTitle,
      eventType,
      guestCount,
      eventDate,
      startTime,
      endTime,
      responsibleAdmin,
      googleCalendarUrl,
    } = await request.json();

    if (!clientEmail || !clientEmail.includes("@")) {
      return NextResponse.json(
        { error: "O evento não possui um e-mail de cliente válido para envio." },
        { status: 400 }
      );
    }

    const gmailUser = (
      process.env.GMAIL_USER ||
      process.env.NEXT_PUBLIC_GMAIL_USER ||
      ""
    ).trim();

    const gmailPass = (
      process.env.GMAIL_APP_PASSWORD ||
      process.env.NEXT_PUBLIC_GMAIL_APP_PASSWORD ||
      ""
    ).replace(/\s+/g, "");

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        {
          error:
            "Credenciais SMTP ausentes. Configure GMAIL_USER e GMAIL_APP_PASSWORD na Netlify ou no .env.local.",
        },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const formattedDatePtBr = eventDate
      ? String(eventDate).split("-").reverse().join("/")
      : "A confirmar";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; background-color: #0A0E17; color: #F1F5F9; padding: 36px 20px; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #1E293B;">
        <div style="margin-bottom: 20px;">
          <span style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10B981; font-weight: bold; font-size: 11px; letter-spacing: 1.5px; padding: 6px 12px; border-radius: 999px; text-transform: uppercase;">
            ✓ EVENTO CONFIRMADO · CHURRASCO DOS DA HORA
          </span>
        </div>

        <h2 style="color: #FFFFFF; font-size: 22px; margin: 0 0 10px 0;">
          Olá, ${clientName || "Cliente"}! Seu evento está confirmado.
        </h2>

        <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          A administração do <strong>Churrasco dos Da Hora</strong> aprovou a sua reserva. Confira abaixo os dados oficiais do seu agendamento:
        </p>

        <div style="background-color: #111726; border: 1px solid #1E293B; border-radius: 14px; padding: 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.8; color: #E2E8F0;">
          <div><strong style="color: #F59E0B;">Evento:</strong> ${eventTitle || "Reserva Da Hora"} (${eventType || "Evento"})</div>
          <div><strong style="color: #F59E0B;">Data:</strong> ${formattedDatePtBr}</div>
          <div><strong style="color: #F59E0B;">Horário (GMT-3):</strong> ${startTime} às ${endTime} (+1h de limpeza interna)</div>
          <div><strong style="color: #F59E0B;">Quantidade de pessoas:</strong> ${guestCount || "Confirmada"}</div>
          <div><strong style="color: #F59E0B;">Responsável ADM:</strong> ${responsibleAdmin || "Administrador Da Hora"}</div>
        </div>

        ${
          googleCalendarUrl
            ? `<div style="text-align: center; margin: 24px 0;">
                <a href="${googleCalendarUrl}" style="background-color: #10B981; color: #0A0E17; text-decoration: none; font-weight: 800; font-size: 13px; padding: 14px 24px; border-radius: 12px; display: inline-block;">
                  📅 Salvar evento no meu Google Calendar →
                </a>
              </div>`
            : ""
        }

        <hr style="border: none; border-top: 1px solid #1E293B; margin: 24px 0;" />

        <p style="color: #64748B; font-size: 11px; margin: 0;">
          Precisa ajustar algum detalhe? Acesse sua Área do Cliente na plataforma Churrasco dos Da Hora.
        </p>
      </div>
    `;

    await new Promise<void>((resolve, reject) => {
      transporter.sendMail(
        {
          from: `"Churrasco dos Da Hora" <${gmailUser}>`,
          to: clientEmail.trim(),
          subject: `✓ Reserva Confirmada: ${eventTitle || "Seu Evento"} (${formattedDatePtBr}) — Churrasco dos Da Hora`,
          html: htmlBody,
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao enviar e-mail de confirmação para o cliente.";
    console.error("Erro SMTP Confirm Event:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}