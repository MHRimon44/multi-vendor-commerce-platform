import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CatalogService } from './catalog.service.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.js';
import { UserRole } from '../auth/types/user-role.js';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List catalog products',
  })
  findAll(@Query() query: CatalogQueryDto) {
    return this.catalogService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get a product by ID',
  })
  findOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }

  @Post()
  @Roles(UserRole.VENDOR_STAFF)
  @UseGuards(RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a vendor product',
  })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProductDto) {
    const vendorId = request.user?.vendorId;

    if (!vendorId) {
      throw new Error('Authenticated vendor is missing vendorId');
    }

    return this.catalogService.create(vendorId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.VENDOR_STAFF)
  @UseGuards(RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update an owned product',
  })
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProductDto,
  ) {
    const vendorId = request.user?.vendorId;

    if (!vendorId) {
      throw new Error('Authenticated vendor is missing vendorId');
    }

    return this.catalogService.update(id, vendorId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.VENDOR_STAFF)
  @UseGuards(RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Deactivate an owned product',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest): void {
    const vendorId = request.user?.vendorId;

    if (!vendorId) {
      throw new Error('Authenticated vendor is missing vendorId');
    }

    this.catalogService.remove(id, vendorId);
  }
}
