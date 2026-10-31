import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum InventoryReservationStatus {
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
  CONSUMED = 'CONSUMED',
}

@Entity('inventory_reservations')
@Check('"quantity" > 0')
export class InventoryReservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  inventoryId!: string;

  @Column()
  skuId!: string;

  @Column()
  orderId!: string;

  @Column()
  customerId!: string;

  @Column({
    type: 'integer',
  })
  quantity!: number;

  @Column({
    type: 'enum',
    enum: InventoryReservationStatus,
    default: InventoryReservationStatus.ACTIVE,
  })
  status!: InventoryReservationStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  releasedAt!: Date | null;
}
