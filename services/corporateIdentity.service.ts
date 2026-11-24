// services/corporateIdentity.service.ts
import { CorporateIdentityInfo, UserAccount, UserRole } from "../models/user.model";

const ROLE_CODE_PREFIX: Record<UserRole, string> = {
  ADM: "ADM",
  EQUIPE_INTERNA: "INT",
  EQUIPE_EXTERNA: "EXT",
  CLIENTE: "CLI",
};

const ROLE_CLEARANCE_LABELS: Record<UserRole, string> = {
  ADM: "NÍVEL 4 · GOVERNANÇA TOTAL",
  EQUIPE_INTERNA: "NÍVEL 3 · OPERAÇÃO INTERNA",
  EQUIPE_EXTERNA: "NÍVEL 2 · PARCEIRO CREDENCIADO",
  CLIENTE: "NÍVEL 1 · CLIENTE TITULAR",
};

/**
 * Generates standardized corporate badge metadata (CDH-XXX-0000) for any user profile (Card #47).
 */
export function getCorporateIdentityInfo(
  user: Pick<UserAccount, "id" | "role" | "status" | "specialty">
): CorporateIdentityInfo {
  const numericSuffix = (user.id.split("-")[1] || "0001").padStart(4, "0");
  const rolePrefix = ROLE_CODE_PREFIX[user.role] || "CLI";
  const corporateCode = `CDH-${rolePrefix}-${numericSuffix}`;
  const clearanceLevel = ROLE_CLEARANCE_LABELS[user.role] || ROLE_CLEARANCE_LABELS.CLIENTE;

  const unitDepartment = resolveUnitDepartment(user.role, user.specialty);

  return {
    corporateCode,
    clearanceLevel,
    unitDepartment,
  };
}

function resolveUnitDepartment(role: UserRole, specialty?: string): string {
  if (role === "ADM") return "Diretoria Familiar Da Hora";
  if (role === "EQUIPE_INTERNA") return "Gestão de Espaço & Apoio";
  if (role === "EQUIPE_EXTERNA") return `Operação Terceirizada (${specialty || "Serviços"})`;
  return "Portal de Reservas";
}