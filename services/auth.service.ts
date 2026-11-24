// services/auth.service.ts
import { FIRST_LOGIN_ISO_MARKERS, RBAC_SECURITY_LIMITS } from "../config/constants";
import { UserAccount } from "../models/user.model";

export interface ResetTokenVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Encodes the first-login password change requirement into an ISO timestamp suffix (.001Z) (Card #42).
 */
export function markIsoForFirstLogin(isoDate?: string): string {
  const parsedDate = isoDate ? new Date(isoDate) : new Date();
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return validDate
    .toISOString()
    .replace(/\.\d{3}Z$/, FIRST_LOGIN_ISO_MARKERS.REQUIRED_SUFFIX);
}

/**
 * Marks an ISO timestamp as having completed the mandatory password change (.000Z) (Card #42).
 */
export function markIsoPasswordChanged(isoDate?: string): string {
  const parsedDate = isoDate ? new Date(isoDate) : new Date();
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return validDate
    .toISOString()
    .replace(/\.\d{3}Z$/, FIRST_LOGIN_ISO_MARKERS.COMPLETED_SUFFIX);
}

/**
 * Determines whether a user account must change its password on login (Card #42).
 */
export function isFirstLoginPasswordChangeRequired(user: UserAccount): boolean {
  if (user.mustChangePassword === true) return true;
  return Boolean(
    user.passwordChangedAtIso &&
      user.passwordChangedAtIso.endsWith(FIRST_LOGIN_ISO_MARKERS.REQUIRED_SUFFIX)
  );
}

/**
 * Generates a 15-minute Base64 recovery token bound to a target email.
 */
export function createPasswordResetToken(email: string): string {
  const payload = {
    e: email.trim().toLowerCase(),
    exp: Date.now() + RBAC_SECURITY_LIMITS.RESET_TOKEN_TTL_MS,
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Validates a Base64 recovery token against the target email and expiration window.
 */
export function verifyPasswordResetToken(
  token: string,
  email: string
): ResetTokenVerificationResult {
  try {
    const decoded = JSON.parse(atob(token)) as { e: string; exp: number };
    if (!decoded || decoded.e !== email.trim().toLowerCase()) {
      return {
        valid: false,
        reason: "O link de recuperação não corresponde a este e-mail.",
      };
    }
    if (Date.now() > decoded.exp) {
      return {
        valid: false,
        reason: "Este link expirou (limite de 15 minutos). Solicite um novo link.",
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      reason: "Link de recuperação inválido ou corrompido.",
    };
  }
}