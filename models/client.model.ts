// models/client.model.ts
import { UserStatus } from "./user.model";

export interface ClientRecord {
  id: string;
  name: string;
  email: string;
  phoneAnatel: string;
  cpfCnpj?: string;
  status: UserStatus;
  passwordChangedAtIso: string;
}