import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AuthenticatedRequest } from '../types/authenticated-request.js';
import { UserRole } from '../types/user-role.js';

@Injectable()
export class VendorOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user) {
      return false;
    }

    const requestedVendorId = request.params['vendorId'];

    if (!requestedVendorId) {
      throw new ForbiddenException('Vendor context is required');
    }

    /*
     * Admin access is explicit here.
     *
     * We are deliberately choosing to allow ADMIN for this
     * particular resource instead of treating ADMIN as an
     * automatic bypass everywhere in the application.
     */
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (user.role !== UserRole.VENDOR_STAFF) {
      throw new ForbiddenException('Vendor access is required');
    }

    if (!user.vendorId) {
      throw new ForbiddenException('Vendor identity is missing');
    }

    if (user.vendorId !== requestedVendorId) {
      throw new ForbiddenException('You cannot access another vendor resource');
    }

    return true;
  }
}
