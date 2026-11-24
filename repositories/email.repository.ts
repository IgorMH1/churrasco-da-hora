// repositories/email.repository.ts

export interface PasswordRecoveryEmailRequest {
  email: string;
  userName: string;
  resetUrl: string;
}

export interface EventConfirmationEmailRequest {
  clientEmail: string;
  clientName: string;
  eventTitle: string;
  eventType: string;
  guestCount: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  responsibleAdmin: string;
  googleCalendarUrl: string;
}

export interface EmailDispatchResult {
  ok: boolean;
  error?: string;
}

/**
 * Dispatches a password recovery email via the serverless Gmail SMTP endpoint (Card #48).
 */
export async function sendPasswordRecoveryEmail(
  payload: PasswordRecoveryEmailRequest
): Promise<EmailDispatchResult> {
  try {
    const response = await fetch("/api/recover-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      return {
        ok: false,
        error:
          data.error ||
          "Não foi possível enviar o e-mail pelo Gmail. Verifique as variáveis de ambiente.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Erro de conexão ao tentar disparar o e-mail de recuperação.",
    };
  }
}

/**
 * Dispatches an automated event confirmation email to the client (Card #39).
 */
export async function sendEventConfirmationEmail(
  payload: EventConfirmationEmailRequest
): Promise<EmailDispatchResult> {
  try {
    const response = await fetch("/api/confirm-event-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || "Aviso SMTP pendente." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Falha de rede SMTP." };
  }
}