import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RolesGuard } from './guards/roles.guard.js';
import { VendorOwnershipGuard } from './guards/vendor-ownership.guard.js';
import type { AuthenticatedRequest } from './types/authenticated-request.js';
import { UserRole } from './types/user-role.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  adminOnly() {
    return {
      message: 'Admin access granted',
    };
  }

  /*
   * Temporary authorization demonstration endpoint.
   *
   * Catalog/inventory resources will consume the same
   * ownership guard as those modules are implemented.
   */
  @Get('vendors/:vendorId')
  @Roles(UserRole.VENDOR_STAFF, UserRole.ADMIN)
  @UseGuards(RolesGuard, VendorOwnershipGuard)
  vendorResource(@Param('vendorId') vendorId: string) {
    return {
      vendorId,
      message: 'Vendor access granted',
    };
  }
}
