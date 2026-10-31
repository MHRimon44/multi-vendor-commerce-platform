import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('inventory_adjustments')
export class InventoryAdjustmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  inventoryId!: string;

  @Column()
  vendorId!: string;

  @Column()
  skuId!: string;

  @Column({
    type: 'integer',
  })
  change!: number;

  @Column({
    type: 'integer',
  })
  quantityBefore!: number;

  @Column({
    type: 'integer',
  })
  quantityAfter!: number;

  @Column()
  reason!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
