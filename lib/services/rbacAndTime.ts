// src/lib/services/rbacAndTime.ts
// Regras RBAC de Senha, Fuso Horário GMT-3 (America/Sao_Paulo) e Disponibilidade de Datas

export const TIMEZONE_BRT = 'America/Sao_Paulo';
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 30;
export const PASSWORD_MAX_AGE_DAYS = 90;

export interface PasswordValidation {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

// Verifica em tempo real os requisitos RBAC da senha
export function validatePasswordRbac(password: string): PasswordValidation {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
  };
}

// Retorna a data de hoje (AAAA-MM-DD) e a hora atual estritamente em GMT-3 (Brasília)
export function getNowGmt3(): { dateStr: string; timeStr: string; formattedPtBr: string } {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BRT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = dateParts.find((p) => p.type === 'year')?.value || '2026';
  const m = dateParts.find((p) => p.type === 'month')?.value || '01';
  const d = dateParts.find((p) => p.type === 'day')?.value || '01';

  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_BRT,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  return {
    dateStr: `${y}-${m}-${d}`,
    timeStr,
    formattedPtBr: `${d}/${m}/${y} às ${timeStr} (GMT-3)`,
  };
}

// Calcula quantos dias faltam para a senha expirar (limite de 90 dias)
export function getPasswordDaysRemaining(passwordChangedAtIso: string): number {
  const changedDate = new Date(passwordChangedAtIso).getTime();
  const now = Date.now();
  const daysPassed = Math.floor((now - changedDate) / (1000 * 60 * 60 * 24));
  return PASSWORD_MAX_AGE_DAYS - daysPassed;
}

// Converte horário "HH:MM" em minutos totais para checar conflito + 60 min de limpeza
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function hasScheduleConflict(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string,
  cleanupBufferMin = 60
): boolean {
  const nStart = timeToMinutes(newStart);
  const nEnd = timeToMinutes(newEnd) + cleanupBufferMin;
  const eStart = timeToMinutes(existingStart);
  const eEnd = timeToMinutes(existingEnd) + cleanupBufferMin;
  return nStart < eEnd && nEnd > eStart;
}