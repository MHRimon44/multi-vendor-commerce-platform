import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { OrderEntity } from './order.entity.js';

@Entity('order_items')
@Check('"quantity" > 0')
@Check('"unitPrice" >= 0')
@Check('"lineTotal" >= 0')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'orderId',
  })
  order!: Relation<OrderEntity>;

  @Column()
  skuId!: string;

  @Column()
  sku!: string;

  @Column()
  productName!: string;

  @Column()
  vendorId!: string;

  @Column({
    type: 'integer',
  })
  quantity!: number;

  @Column({
    type: 'integer',
  })
  unitPrice!: number;

  @Column({
    type: 'integer',
  })
  lineTotal!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
