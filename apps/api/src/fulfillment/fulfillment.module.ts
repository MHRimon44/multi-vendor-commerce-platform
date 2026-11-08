import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VendorOrderEntity } from '../database/entities/vendor-order.entity.js';
import { ShipmentEventEntity } from '../database/entities/shipment-event.entity.js';

import { FulfillmentController } from './fulfillment.controller.js';
import { FulfillmentService } from './fulfillment.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([VendorOrderEntity, ShipmentEventEntity])],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
