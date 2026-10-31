import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { CartEntity } from '../database/entities/cart.entity.js';
import { CartItemEntity } from '../database/entities/cart-item.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';
import { OrderEntity, OrderStatus } from '../database/entities/order.entity.js';
import { OrderItemEntity } from '../database/entities/order-item.entity.js';
import { ProductEntity } from '../database/entities/product.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async checkout(customerId: string): Promise<OrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const cart = await manager.findOne(CartEntity, {
        where: {
          customerId,
        },
        relations: {
          items: true,
        },
      });

      if (!cart) {
        throw new BadRequestException('Cart does not exist');
      }

      if (!cart.items || cart.items.length === 0) {
        throw new BadRequestException('Cannot checkout an empty cart');
      }

      const preparedItems = await this.prepareOrderItems(manager, cart.items);

      const totalAmount = preparedItems.reduce(
        (total, item) => total + item.lineTotal,
        0,
      );

      const order = manager.create(OrderEntity, {
        customerId,
        status: OrderStatus.PENDING,
        totalAmount,
      });

      const savedOrder = await manager.save(OrderEntity, order);

      const orderItems = preparedItems.map((item) =>
        manager.create(OrderItemEntity, {
          orderId: savedOrder.id,
          skuId: item.skuId,
          sku: item.sku,
          productName: item.productName,
          vendorId: item.vendorId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }),
      );

      await manager.save(OrderItemEntity, orderItems);

      await manager.delete(CartItemEntity, {
        cartId: cart.id,
      });

      return this.findOrderWithItems(manager, savedOrder.id, customerId);
    });
  }

  async findAllForCustomer(customerId: string): Promise<OrderEntity[]> {
    return this.orderRepository.find({
      where: {
        customerId,
      },
      relations: {
        items: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOneForCustomer(
    customerId: string,
    orderId: string,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: {
        id: orderId,
        customerId,
      },
      relations: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private async prepareOrderItems(
    manager: EntityManager,
    cartItems: CartItemEntity[],
  ): Promise<
    Array<{
      skuId: string;
      sku: string;
      productName: string;
      vendorId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>
  > {
    const preparedItems = [];

    for (const cartItem of cartItems) {
      const sku = await manager.findOne(ProductSkuEntity, {
        where: {
          id: cartItem.skuId,
        },
      });

      if (!sku || !sku.active) {
        throw new BadRequestException(`SKU ${cartItem.skuId} is unavailable`);
      }

      const product = await manager.findOne(ProductEntity, {
        where: {
          id: sku.productId,
        },
      });

      if (!product || !product.active) {
        throw new BadRequestException(
          `Product for SKU ${sku.sku} is unavailable`,
        );
      }

      const inventory = await manager.findOne(InventoryEntity, {
        where: {
          skuId: sku.id,
        },
      });

      if (!inventory) {
        throw new BadRequestException(
          `Inventory for SKU ${sku.sku} was not found`,
        );
      }

      const availableQuantity = inventory.quantity - inventory.reservedQuantity;

      if (cartItem.quantity > availableQuantity) {
        throw new BadRequestException(`Insufficient stock for SKU ${sku.sku}`);
      }

      const unitPrice = sku.price;

      const lineTotal = unitPrice * cartItem.quantity;

      preparedItems.push({
        skuId: sku.id,
        sku: sku.sku,
        productName: product.name,
        vendorId: product.vendorId,
        quantity: cartItem.quantity,
        unitPrice,
        lineTotal,
      });
    }

    return preparedItems;
  }

  private async findOrderWithItems(
    manager: EntityManager,
    orderId: string,
    customerId: string,
  ): Promise<OrderEntity> {
    const order = await manager.findOne(OrderEntity, {
      where: {
        id: orderId,
        customerId,
      },
      relations: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found after checkout');
    }

    return order;
  }
}
