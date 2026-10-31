import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { CartEntity } from '../database/entities/cart.entity.js';
import { CartItemEntity } from '../database/entities/cart-item.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';
import {
  InventoryReservationEntity,
  InventoryReservationStatus,
} from '../database/entities/inventory-reservation.entity.js';
import { OrderEntity, OrderStatus } from '../database/entities/order.entity.js';
import { OrderItemEntity } from '../database/entities/order-item.entity.js';
import { ProductEntity } from '../database/entities/product.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';

interface PreparedOrderItem {
  inventory: InventoryEntity;
  skuId: string;
  sku: string;
  productName: string;
  vendorId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

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

      /*
       * Lock inventory in deterministic SKU order.
       *
       * Deterministic ordering reduces deadlock risk
       * when an order contains multiple SKUs.
       */
      const sortedCartItems = [...cart.items].sort((a, b) =>
        a.skuId.localeCompare(b.skuId),
      );

      const preparedItems = await this.prepareOrderItems(
        manager,
        sortedCartItems,
      );

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

      /*
       * Reserve stock while the inventory rows
       * are still locked by this transaction.
       */
      for (const item of preparedItems) {
        item.inventory.reservedQuantity += item.quantity;

        await manager.save(InventoryEntity, item.inventory);

        const reservation = manager.create(InventoryReservationEntity, {
          inventoryId: item.inventory.id,
          skuId: item.skuId,
          orderId: savedOrder.id,
          customerId,
          quantity: item.quantity,
          status: InventoryReservationStatus.ACTIVE,
          releasedAt: null,
        });

        await manager.save(InventoryReservationEntity, reservation);
      }

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

  async cancelOrder(customerId: string, orderId: string): Promise<OrderEntity> {
    return this.dataSource.transaction(async (manager) => {
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
        throw new NotFoundException('Order not found');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Order is already cancelled');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Only pending orders can be cancelled');
      }

      const reservations = await manager.find(InventoryReservationEntity, {
        where: {
          orderId,
          status: InventoryReservationStatus.ACTIVE,
        },
      });

      /*
       * Lock inventory rows in deterministic order
       * before releasing reservations.
       */
      const sortedReservations = [...reservations].sort((a, b) =>
        a.inventoryId.localeCompare(b.inventoryId),
      );

      for (const reservation of sortedReservations) {
        const inventory = await manager
          .getRepository(InventoryEntity)
          .createQueryBuilder('inventory')
          .setLock('pessimistic_write')
          .where('inventory.id = :id', {
            id: reservation.inventoryId,
          })
          .getOne();

        if (!inventory) {
          throw new NotFoundException(
            `Inventory ${reservation.inventoryId} not found`,
          );
        }

        if (inventory.reservedQuantity < reservation.quantity) {
          throw new ConflictException(
            `Invalid reservation state for SKU ${reservation.skuId}`,
          );
        }

        inventory.reservedQuantity -= reservation.quantity;

        await manager.save(InventoryEntity, inventory);

        reservation.status = InventoryReservationStatus.RELEASED;

        reservation.releasedAt = new Date();

        await manager.save(InventoryReservationEntity, reservation);
      }

      order.status = OrderStatus.CANCELLED;

      await manager.save(OrderEntity, order);

      return this.findOrderWithItems(manager, order.id, customerId);
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
  ): Promise<PreparedOrderItem[]> {
    const preparedItems: PreparedOrderItem[] = [];

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

      /*
       * SELECT ... FOR UPDATE
       *
       * PostgreSQL keeps this row locked until
       * the current transaction commits/rolls back.
       */
      const inventory = await manager
        .getRepository(InventoryEntity)
        .createQueryBuilder('inventory')
        .setLock('pessimistic_write')
        .where('inventory.skuId = :skuId', {
          skuId: sku.id,
        })
        .getOne();

      if (!inventory) {
        throw new BadRequestException(
          `Inventory for SKU ${sku.sku} was not found`,
        );
      }

      const availableQuantity = inventory.quantity - inventory.reservedQuantity;

      if (cartItem.quantity > availableQuantity) {
        throw new ConflictException(
          `Insufficient available stock for SKU ${sku.sku}`,
        );
      }

      const unitPrice = sku.price;

      preparedItems.push({
        inventory,
        skuId: sku.id,
        sku: sku.sku,
        productName: product.name,
        vendorId: product.vendorId,
        quantity: cartItem.quantity,
        unitPrice,
        lineTotal: unitPrice * cartItem.quantity,
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
