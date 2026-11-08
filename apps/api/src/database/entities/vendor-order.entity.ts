import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum VendorFulfillmentStatus {
  CONFIRMED = 'CONFIRMED',
  PACKED = 'PACKED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

@Entity('vendor_orders')
@Unique(['orderId', 'vendorId'])
@Index(['vendorId', 'status'])
@Check('"totalAmount" >= 0')
export class VendorOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  orderId!: string;

  @Column()
  vendorId!: string;

  @Column({
    type: 'enum',
    enum: VendorFulfillmentStatus,
    default: VendorFulfillmentStatus.CONFIRMED,
  })
  status!: VendorFulfillmentStatus;

  @Column('integer')
  totalAmount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
