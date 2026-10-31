import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { ProductSkuEntity } from './product-sku.entity.js';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  vendorId!: string;

  @Column()
  name!: string;

  @Column({
    type: 'text',
    default: '',
  })
  description!: string;

  @Column({
    default: true,
  })
  active!: boolean;

  @OneToMany(() => ProductSkuEntity, (sku) => sku.product, {
    cascade: true,
  })
  skus!: Relation<ProductSkuEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
