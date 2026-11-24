// models/user.model.ts
import { ShiftPeriod, WorkModel } from "./staff.model";

export type UserRole = "ADM" | "EQUIPE_INTERNA" | "EQUIPE_EXTERNA" | "CLIENTE";
export type UserStatus = "ATIVO" | "INATIVO" | "BLOQUEADO";

export interface UserAccount {
  id: string;
  corporateId?: string;
  name: string;
  email: string;
  phoneAnatel: string;
  cpfCnpj?: string;
  password: string;
  role: UserRole;
  specialty?: string;
  companyName?: string;
  dailyRate?: number;
  rateDiurna?: number;
  rateVespertina?: number;
  rateNoturna?: number;
  shiftPeriod?: ShiftPeriod;
  workModel?: WorkModel;
  status: UserStatus;
  passwordChangedAtIso: string;
  mustChangePassword?: boolean;
}

export interface CorporateIdentityInfo {
  corporateCode: string;
  clearanceLevel: string;
  unitDepartment: string;
}

export interface UserExtendedMeta {
  corporateId?: string;
  rateDiurna?: number;
  rateVespertina?: number;
  rateNoturna?: number;
  shiftPeriod?: ShiftPeriod;
  workModel?: WorkModel;
  mustChangePassword?: boolean;
}

export interface CreateUserAccountDto {
  name: string;
  email: string;
  phoneAnatel: string;
  password: string;
  role: UserRole;
  specialty?: string;
  companyName?: string;
  rateDiurna?: number;
  rateVespertina?: number;
  rateNoturna?: number;
  workModel?: WorkModel;
  shiftPeriod?: ShiftPeriod;
  status: UserStatus;
  forceFirstLoginReset: boolean;
}

export interface UpdateOwnProfileDto {
  userId: string;
  name: string;
  email: string;
  phoneAnatel: string;
  specialty?: string;
  companyName?: string;
}