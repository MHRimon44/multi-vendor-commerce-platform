import { UserRole } from './user-role.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  vendorId?: string;
}
