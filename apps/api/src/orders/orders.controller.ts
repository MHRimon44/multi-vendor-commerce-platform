import {
  Body,
  Controller,
  Get,
  Param,
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

import { CheckoutDto } from './dto/checkout.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
@Roles(UserRole.CUSTOMER)
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'Create an order from the current customer cart',
  })
  checkout(@Req() request: AuthenticatedRequest, @Body() _dto: CheckoutDto) {
    const customerId = this.getCustomerId(request);

    return this.ordersService.checkout(customerId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get customer order history',
  })
  findAll(@Req() request: AuthenticatedRequest) {
    const customerId = this.getCustomerId(request);

    return this.ordersService.findAllForCustomer(customerId);
  }
  @Post(':orderId/cancel')
  @ApiOperation({
    summary: 'Cancel a pending order and release its stock reservation',
  })
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    const customerId = this.getCustomerId(request);

    return this.ordersService.cancelOrder(customerId, orderId);
  }
  @Get(':orderId')
  @ApiOperation({
    summary: 'Get customer order details',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    const customerId = this.getCustomerId(request);

    return this.ordersService.findOneForCustomer(customerId, orderId);
  }

  private getCustomerId(request: AuthenticatedRequest): string {
    const customerId = request.user?.id;

    if (!customerId) {
      throw new UnauthorizedException('Authenticated customer is missing');
    }

    return customerId;
  }
}
