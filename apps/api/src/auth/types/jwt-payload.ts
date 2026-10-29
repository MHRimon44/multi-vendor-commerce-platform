import { UserRole } from './user-role.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  vendorId?: string;
}
