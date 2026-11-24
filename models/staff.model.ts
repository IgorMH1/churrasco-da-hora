// models/staff.model.ts
import { UserStatus } from "./user.model";

export type ShiftPeriod = "DIURNO" | "VESPERTINO" | "NOTURNO" | "INTEGRAL";
export type WorkModel = "PRESENCIAL" | "HIBRIDO" | "VOLANTE";
export type StaffType = "INTERNA" | "EXTERNA_TERCEIRO";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  staffType: StaffType;
  specialty: string;
  companyName?: string;
  dailyRate: number;
  rateDiurna?: number;
  rateVespertina?: number;
  rateNoturna?: number;
  shiftPeriod?: ShiftPeriod;
  workModel?: WorkModel;
  status: UserStatus;
  passwordChangedAtIso: string;
}

export interface RoleParameterRule {
  id: string;
  functionName: string;
  targetRole: "EQUIPE_INTERNA" | "EQUIPE_EXTERNA";
  workModel: WorkModel;
  defaultPeriod: ShiftPeriod;
  rateDiurna: number;
  rateVespertina: number;
  rateNoturna: number;
}

export interface CalculatedShiftRate {
  shiftLabel: string;
  rateValue: number;
}