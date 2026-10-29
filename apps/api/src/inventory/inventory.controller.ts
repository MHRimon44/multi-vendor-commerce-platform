import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.js';
import { UserRole } from '../auth/types/user-role.js';

import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
@Roles(UserRole.VENDOR_STAFF, UserRole.ADMIN)
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @ApiOperation({
    summary: 'Create inventory for a SKU',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInventoryDto,
  ) {
    const vendorId = this.getVendorId(request);

    return this.inventoryService.create(vendorId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List inventory for current vendor',
  })
  findAll(@Req() request: AuthenticatedRequest) {
    const vendorId = this.getVendorId(request);

    return this.inventoryService.findAll(vendorId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an inventory record',
  })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id/adjust')
  @ApiOperation({
    summary: 'Adjust SKU stock with audit reason',
  })
  adjust(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdjustStockDto,
  ) {
    const vendorId = this.getVendorId(request);

    return this.inventoryService.adjust(id, vendorId, dto);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get stock adjustment history',
  })
  getHistory(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const vendorId = this.getVendorId(request);

    return this.inventoryService.getHistory(id, vendorId);
  }

  private getVendorId(request: AuthenticatedRequest): string {
    const vendorId = request.user?.vendorId;

    if (!vendorId) {
      throw new Error('Authenticated vendor is missing vendorId');
    }

    return vendorId;
  }
}
