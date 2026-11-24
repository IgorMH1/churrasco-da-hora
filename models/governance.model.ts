// models/governance.model.ts
import { UserAccount } from "./user.model";
import { EventRecord } from "./event.model";
import { ClientRecord } from "./client.model";
import { StaffMember } from "./staff.model";

export type BackupScope = "Usuários" | "Eventos" | "Completo";
export type BackupFormat = "JSON" | "SQL";
export type ApiOperationalState = "ONLINE" | "ALERTA" | "OFFLINE";

export interface BackupLogRecord {
  id: string;
  scope: BackupScope;
  format: BackupFormat;
  exportedAtGmt3: string;
  exportedBy: string;
}

export interface BackupSnapshotPayload {
  id: string;
  savedAtGmt3: string;
  savedBy: string;
  scope: BackupScope;
  users: UserAccount[];
  events: EventRecord[];
  clients: ClientRecord[];
  staff: StaffMember[];
}

export interface ApiHealthStatus {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  status: ApiOperationalState;
  latencyMs: number;
  uptimePercent: string;
  detail: string;
  checkedAtGmt3: string;
}

export interface EmergencyMaintenanceState {
  active: boolean;
  activatedAtGmt3?: string;
  activatedBy?: string;
  lockedUserIds: string[];
}

export interface SupabaseFullDataset {
  users: UserAccount[];
  events: EventRecord[];
  clients: ClientRecord[];
  staff: StaffMember[];
  backupLogs: BackupLogRecord[];
}