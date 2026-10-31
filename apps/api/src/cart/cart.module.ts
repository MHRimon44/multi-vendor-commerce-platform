import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartEntity } from '../database/entities/cart.entity.js';
import { CartItemEntity } from '../database/entities/cart-item.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';

import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CartEntity,
      CartItemEntity,
      ProductSkuEntity,
      InventoryEntity,
    ]),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
