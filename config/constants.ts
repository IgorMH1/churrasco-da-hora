// config/constants.ts
import { UserAccount } from "../models/user.model";
import { RoleParameterRule } from "../models/staff.model";

export const RBAC_SECURITY_LIMITS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,
  PASSWORD_EXPIRATION_DAYS: 90,
  MIN_PASSWORD_LENGTH: 8,
  RESET_TOKEN_TTL_MS: 15 * 60 * 1000,
} as const;

export const SCHEDULE_RULES = {
  CLEANUP_BUFFER_MINUTES: 60,
  CALENDAR_DOUBLE_CLICK_THRESHOLD_MS: 500,
  MORNING_SHIFT_END_HOUR: 12,
  AFTERNOON_SHIFT_END_HOUR: 18,
  DEFAULT_START_TIME: "16:00",
  DEFAULT_END_TIME: "21:00",
  TIMEZONE_IANA: "America/Sao_Paulo",
} as const;

export const FIRST_LOGIN_ISO_MARKERS = {
  REQUIRED_SUFFIX: ".001Z",
  COMPLETED_SUFFIX: ".000Z",
} as const;

export const SUPABASE_FALLBACK_CONFIG = {
  URL: "https://fgyaeefzpaxivrekyhhq.supabase.co",
  PUBLISHABLE_KEY: "sb_publishable_2PQxwv1WGsznqEQ8bD3eNA_E36YbO_T",
} as const;

export const DEFAULT_ADMIN_USER: UserAccount = {
  id: "ADM-0001",
  corporateId: "CDH-ADM-0001",
  name: "Administrador Da Hora",
  email: "admin@churrascodahora.com",
  phoneAnatel: "(11) 99999-0000",
  password: "Admin@2026",
  role: "ADM",
  specialty: "Gestor Geral Familiar",
  companyName: "Família Da Hora",
  dailyRate: 0,
  rateDiurna: 0,
  rateVespertina: 0,
  rateNoturna: 0,
  shiftPeriod: "INTEGRAL",
  workModel: "PRESENCIAL",
  status: "ATIVO",
  passwordChangedAtIso: "2026-11-15T12:00:00.000Z",
  mustChangePassword: false,
};

export const DEFAULT_ROLE_RULES: RoleParameterRule[] = [
  {
    id: "RULE-01",
    functionName: "Churrasqueiro Mestre",
    targetRole: "EQUIPE_EXTERNA",
    workModel: "PRESENCIAL",
    defaultPeriod: "DIURNO",
    rateDiurna: 380,
    rateVespertina: 420,
    rateNoturna: 480,
  },
  {
    id: "RULE-02",
    functionName: "Garçom / Atendimento",
    targetRole: "EQUIPE_EXTERNA",
    workModel: "PRESENCIAL",
    defaultPeriod: "VESPERTINO",
    rateDiurna: 220,
    rateVespertina: 250,
    rateNoturna: 290,
  },
  {
    id: "RULE-03",
    functionName: "Limpeza e Higienização (+1h)",
    targetRole: "EQUIPE_EXTERNA",
    workModel: "PRESENCIAL",
    defaultPeriod: "INTEGRAL",
    rateDiurna: 200,
    rateVespertina: 220,
    rateNoturna: 260,
  },
  {
    id: "RULE-04",
    functionName: "Coordenação e Recepção Interna",
    targetRole: "EQUIPE_INTERNA",
    workModel: "HIBRIDO",
    defaultPeriod: "INTEGRAL",
    rateDiurna: 0,
    rateVespertina: 0,
    rateNoturna: 0,
  },
];