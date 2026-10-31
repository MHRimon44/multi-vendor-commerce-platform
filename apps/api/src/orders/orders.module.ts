import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartEntity } from '../database/entities/cart.entity.js';
import { CartItemEntity } from '../database/entities/cart-item.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';
import { OrderEntity } from '../database/entities/order.entity.js';
import { OrderItemEntity } from '../database/entities/order-item.entity.js';
import { ProductEntity } from '../database/entities/product.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';

import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

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
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
