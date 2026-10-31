import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory')
@Check('"quantity" >= 0')
@Check('"reservedQuantity" >= 0')
@Check('"reservedQuantity" <= "quantity"')
export class InventoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  vendorId!: string;

  @Column({
    unique: true,
  })
  skuId!: string;

  @Column()
  sku!: string;

  @Column({
    type: 'integer',
    default: 0,
  })
  quantity!: number;

  @Column({
    type: 'integer',
    default: 0,
  })
  reservedQuantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
