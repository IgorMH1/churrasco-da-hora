// app/api/recover-password/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Garante execução em Node.js puro na Netlify (evita falha de socket TLS no Edge Runtime)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, userName, resetUrl } = await request.json();

    if (!email || !resetUrl) {
      return NextResponse.json(
        { error: "E-mail de destino e link de recuperação são obrigatórios." },
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
            "Credenciais SMTP ausentes. Cadastre GMAIL_USER e GMAIL_APP_PASSWORD em Environment Variables na Netlify (ou no .env.local).",
        },
        { status: 500 }
      );
    }

    // Configuração explícita na porta 465 (SSL) compatível com AWS Lambda / Netlify Functions
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

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; background-color: #0A0E17; color: #F1F5F9; padding: 36px 20px; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #1E293B;">
        <div style="margin-bottom: 24px;">
          <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #F59E0B; font-weight: bold; font-size: 11px; letter-spacing: 2px; padding: 6px 12px; border-radius: 999px; text-transform: uppercase;">
            🔥 CHURRASCO DOS DA HORA
          </span>
        </div>

        <h2 style="color: #FFFFFF; font-size: 22px; margin: 0 0 12px 0;">
          Olá, ${userName || "usuário(a)"}!
        </h2>

        <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
          Recebemos uma solicitação para redefinir a senha da sua conta no sistema <strong>Churrasco dos Da Hora</strong>.
          Clique no botão abaixo para abrir diretamente a aba exclusiva de troca de senha:
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #F59E0B; color: #0A0E17; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block;">
            Redefinir minha senha agora →
          </a>
        </div>

        <p style="color: #64748B; font-size: 12px; line-height: 1.5; margin: 24px 0 8px 0;">
          Se o botão acima não abrir, copie e cole este link no seu navegador:<br/>
          <a href="${resetUrl}" style="color: #F59E0B; word-break: break-all;">${resetUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #1E293B; margin: 24px 0;" />

        <p style="color: #475569; font-size: 11px; margin: 0;">
          Este link é válido por <strong>15 minutos</strong> (Governança RBAC · GMT-3). Caso você não tenha solicitado a troca de senha, ignore este e-mail com segurança.
        </p>
      </div>
    `;

    await new Promise<void>((resolve, reject) => {
      transporter.sendMail(
        {
          from: `"Churrasco dos Da Hora" <${gmailUser}>`,
          to: email.trim(),
          subject: "🔒 Link para Redefinir sua Senha — Churrasco dos Da Hora",
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
      err instanceof Error ? err.message : "Falha ao enviar e-mail via Gmail SMTP na Netlify.";
    console.error("Erro SMTP Recover Password:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}