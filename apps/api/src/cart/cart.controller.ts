import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.js';
import { UserRole } from '../auth/types/user-role.js';

import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@Controller('cart')
@Roles(UserRole.CUSTOMER)
@UseGuards(RolesGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current customer cart',
  })
  getCart(@Req() request: AuthenticatedRequest) {
    const customerId = this.getCustomerId(request);

    return this.cartService.getCart(customerId);
  }

  @Post('items')
  @ApiOperation({
    summary: 'Add SKU to cart',
  })
  addItem(@Req() request: AuthenticatedRequest, @Body() dto: AddCartItemDto) {
    const customerId = this.getCustomerId(request);

    return this.cartService.addItem(customerId, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Update cart item quantity',
  })
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const customerId = this.getCustomerId(request);

    return this.cartService.updateItem(customerId, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({
    summary: 'Remove item from cart',
  })
  removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    const customerId = this.getCustomerId(request);

    return this.cartService.removeItem(customerId, itemId);
  }

  @Delete()
  @ApiOperation({
    summary: 'Clear current customer cart',
  })
  clearCart(@Req() request: AuthenticatedRequest) {
    const customerId = this.getCustomerId(request);

    return this.cartService.clearCart(customerId);
  }

  private getCustomerId(request: AuthenticatedRequest): string {
    const customerId = request.user?.id;

    if (!customerId) {
      throw new UnauthorizedException('Authenticated customer is missing');
    }

    return customerId;
  }
}
