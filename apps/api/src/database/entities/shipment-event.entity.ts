import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { VendorFulfillmentStatus } from './vendor-order.entity.js';

@Entity('shipment_events')
@Index(['vendorOrderId', 'createdAt'])
export class ShipmentEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  vendorOrderId!: string;

  @Column({
    type: 'enum',
    enum: VendorFulfillmentStatus,
    nullable: true,
  })
  fromStatus!: VendorFulfillmentStatus | null;

  @Column({
    type: 'enum',
    enum: VendorFulfillmentStatus,
  })
  toStatus!: VendorFulfillmentStatus;

  @Column()
  actorId!: string;

  @Column({ type: 'text' })
  reason!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
