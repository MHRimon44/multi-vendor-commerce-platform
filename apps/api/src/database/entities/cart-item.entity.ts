import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { CartEntity } from './cart.entity.js';

@Entity('cart_items')
@Unique(['cartId', 'skuId'])
@Check('"quantity" > 0')
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  cartId!: string;

  @ManyToOne(() => CartEntity, (cart) => cart.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'cartId',
  })
  cart!: Relation<CartEntity>;

  @Column()
  skuId!: string;

  @Column({
    type: 'integer',
  })
  quantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
