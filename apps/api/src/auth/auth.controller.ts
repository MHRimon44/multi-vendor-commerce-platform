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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
  @ApiBearerAuth('access-token')
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }
  @ApiBearerAuth('access-token')
  @Get('admin')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  adminOnly() {
    return {
      message: 'Admin access granted',
    };
  }

  @ApiBearerAuth('access-token')
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
