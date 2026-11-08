import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

import { OrderEntity } from '../database/entities/order.entity.js';
import { OrderItemEntity } from '../database/entities/order-item.entity.js';

import { CartEntity } from '../database/entities/cart.entity.js';
import { CartItemEntity } from '../database/entities/cart-item.entity.js';

import { ProductEntity } from '../database/entities/product.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';

import { InventoryEntity } from '../database/entities/inventory.entity.js';
import { InventoryReservationEntity } from '../database/entities/inventory-reservation.entity.js';

import { FulfillmentModule } from '../fulfillment/fulfillment.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      CartEntity,
      CartItemEntity,
      ProductEntity,
      ProductSkuEntity,
      InventoryEntity,
      InventoryReservationEntity,
    ]),
    FulfillmentModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
