import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { ProductEntity } from './product.entity.js';

@Entity('product_skus')
export class ProductSkuEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  productId!: string;

  @ManyToOne(() => ProductEntity, (product) => product.skus, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'productId',
  })
  product!: Relation<ProductEntity>;

  @Column({
    unique: true,
  })
  sku!: string;

  @Column()
  name!: string;

  @Column({
    type: 'integer',
  })
  price!: number;

  @Column({
    default: true,
  })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
