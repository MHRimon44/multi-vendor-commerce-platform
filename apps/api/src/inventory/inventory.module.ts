import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InventoryAdjustmentEntity } from '../database/entities/inventory-adjustment.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';

import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryEntity, InventoryAdjustmentEntity]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
