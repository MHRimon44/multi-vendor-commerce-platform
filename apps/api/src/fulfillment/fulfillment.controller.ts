import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/types/user-role.js';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.js';
import { FulfillmentService } from './fulfillment.service.js';
import { UpdateFulfillmentStatusDto } from './dto/update-fulfillment-status.dto.js';

@ApiTags('Fulfillment')
@ApiBearerAuth('access-token')
@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly service: FulfillmentService) {}

  @Get('vendor/my')
  @Roles(UserRole.VENDOR_STAFF)
  @ApiOperation({ summary: 'My vendor fulfillment records' })
  getMyFulfillments(@Req() request: AuthenticatedRequest) {
    const vendorId = request.user?.vendorId;

    if (!vendorId) {
      throw new ForbiddenException('Vendor identity required');
    }

    return this.service.findForVendor(vendorId);
  }

  @Patch(':id/status')
  @Roles(UserRole.VENDOR_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update fulfillment status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFulfillmentStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    return this.service.updateStatus(
      id,
      dto.status,
      user.id,
      user.vendorId,
      user.role === UserRole.ADMIN,
      dto.reason,
    );
  }

  @Get(':id/history')
  @Roles(UserRole.VENDOR_STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Fulfillment transition history' })
  getHistory(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    return this.service.getHistory(
      id,
      user.vendorId,
      user.role === UserRole.ADMIN,
    );
  }
}
