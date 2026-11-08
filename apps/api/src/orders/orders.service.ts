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

import {
  VendorOrderEntity,
  VendorFulfillmentStatus,
} from '../database/entities/vendor-order.entity.js';

import { ShipmentEventEntity } from '../database/entities/shipment-event.entity.js';

import { FulfillmentService } from '../fulfillment/fulfillment.service.js';

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

    private readonly fulfillmentService: FulfillmentService,
  ) {}

  /**
   * DAY 73 + DAY 74 + DAY 75
   *
   * Transactional checkout:
   *
   * 1. Load customer cart.
   * 2. Validate products and SKUs.
   * 3. Lock inventory rows.
   * 4. Check available stock.
   * 5. Create parent order.
   * 6. Reserve inventory.
   * 7. Create order items.
   * 8. Split order into vendor fulfillments.
   * 9. Record initial fulfillment events.
   * 10. Clear cart items.
   *
   * All database changes happen inside one transaction.
   */
  async checkout(customerId: string): Promise<OrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      /*
       * Lock the cart row to prevent simultaneous
       * checkouts of the same customer cart.
       */
      const cart = await manager
        .getRepository(CartEntity)
        .createQueryBuilder('cart')
        .setLock('pessimistic_write')
        .where('cart.customerId = :customerId', {
          customerId,
        })
        .getOne();

      if (!cart) {
        throw new BadRequestException('Cart does not exist');
      }

      const cartItems = await manager.find(CartItemEntity, {
        where: {
          cartId: cart.id,
        },
      });

      if (cartItems.length === 0) {
        throw new BadRequestException('Cannot checkout an empty cart');
      }

      /*
       * DAY 74:
       * Deterministic SKU ordering reduces
       * inventory lock deadlock risk.
       */
      const sortedCartItems = [...cartItems].sort((a, b) =>
        a.skuId.localeCompare(b.skuId),
      );

      /*
       * Validate and lock inventory.
       */
      const preparedItems = await this.prepareOrderItems(
        manager,
        sortedCartItems,
      );

      /*
       * Calculate prices on the server.
       * Never trust prices supplied by the client.
       */
      const totalAmount = preparedItems.reduce(
        (total, item) => total + item.lineTotal,
        0,
      );

      /*
       * DAY 73:
       * Create the parent order.
       */
      const order = manager.create(OrderEntity, {
        customerId,
        status: OrderStatus.PENDING,
        totalAmount,
      });

      const savedOrder = await manager.save(OrderEntity, order);

      /*
       * DAY 74:
       * Reserve inventory while row locks are held.
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

      /*
       * DAY 73:
       * Create immutable order-item snapshots.
       */
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

      const savedOrderItems = await manager.save(OrderItemEntity, orderItems);

      /*
       * DAY 75:
       * Create one vendor fulfillment record
       * for each vendor in the parent order.
       *
       * FulfillmentService uses the SAME
       * transaction manager.
       *
       * It also creates initial CONFIRMED
       * shipment history events.
       */
      await this.fulfillmentService.createVendorOrders(
        manager,
        savedOrder,
        savedOrderItems,
      );

      /*
       * Clear cart items only after the order,
       * reservations and vendor fulfillments
       * have been created successfully.
       */
      await manager.delete(CartItemEntity, {
        cartId: cart.id,
      });

      /*
       * Return parent order with order items.
       */
      return this.findOrderWithItems(manager, savedOrder.id, customerId);
    });
  }

  /**
   * DAY 74 + DAY 75
   *
   * Cancel a parent order.
   *
   * Rules:
   * - Customer must own the order.
   * - Parent order must be PENDING.
   * - Vendor fulfillments must not be SHIPPED
   *   or DELIVERED.
   * - Active inventory reservations are released.
   * - Vendor fulfillments become CANCELLED.
   * - Shipment cancellation events are recorded.
   * - Parent order becomes CANCELLED.
   *
   * Everything runs inside one transaction.
   */
  async cancelOrder(customerId: string, orderId: string): Promise<OrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      /*
       * Lock parent order to serialize cancellation
       * attempts for the same order.
       */
      const order = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', {
          orderId,
        })
        .andWhere('order.customerId = :customerId', {
          customerId,
        })
        .getOne();

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Order is already cancelled');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Only pending orders can be cancelled');
      }

      /*
       * DAY 75:
       * Lock vendor fulfillment records before
       * validating whether cancellation is allowed.
       *
       * This prevents cancellation from racing
       * with a fulfillment status update.
       */
      const vendorOrders = await manager
        .getRepository(VendorOrderEntity)
        .createQueryBuilder('vendorOrder')
        .setLock('pessimistic_write')
        .where('vendorOrder.orderId = :orderId', {
          orderId,
        })
        .orderBy('vendorOrder.id', 'ASC')
        .getMany();

      /*
       * Validate ALL vendor fulfillments before
       * changing inventory or fulfillment states.
       */
      for (const vendorOrder of vendorOrders) {
        const cancellable =
          vendorOrder.status === VendorFulfillmentStatus.CONFIRMED ||
          vendorOrder.status === VendorFulfillmentStatus.PACKED;

        if (!cancellable) {
          throw new ConflictException(
            `Cannot cancel order because vendor ${vendorOrder.vendorId} fulfillment is ${vendorOrder.status}`,
          );
        }
      }

      /*
       * DAY 74:
       * Find active inventory reservations.
       */
      const reservations = await manager.find(InventoryReservationEntity, {
        where: {
          orderId,
          status: InventoryReservationStatus.ACTIVE,
        },
      });

      /*
       * Sort inventory locks consistently.
       */
      const sortedReservations = [...reservations].sort((a, b) =>
        a.skuId.localeCompare(b.skuId),
      );

      /*
       * Release reserved inventory.
       */
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

      /*
       * DAY 75:
       * Cancel vendor fulfillment records
       * and preserve their transition history.
       */
      for (const vendorOrder of vendorOrders) {
        const previousStatus = vendorOrder.status;

        vendorOrder.status = VendorFulfillmentStatus.CANCELLED;

        await manager.save(VendorOrderEntity, vendorOrder);

        const shipmentEvent = manager.create(ShipmentEventEntity, {
          vendorOrderId: vendorOrder.id,
          fromStatus: previousStatus,
          toStatus: VendorFulfillmentStatus.CANCELLED,
          actorId: customerId,
          reason: 'Parent order cancelled by customer',
        });

        await manager.save(ShipmentEventEntity, shipmentEvent);
      }

      /*
       * DAY 74:
       * Update parent order status.
       */
      order.status = OrderStatus.CANCELLED;

      await manager.save(OrderEntity, order);

      return this.findOrderWithItems(manager, order.id, customerId);
    });
  }

  /**
   * List all orders belonging to a customer.
   */
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

  /**
   * Find a single order belonging to a customer.
   */
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

  /**
   * DAY 73 + DAY 74
   *
   * Validate cart items and acquire inventory
   * row locks before creating an order.
   */
  private async prepareOrderItems(
    manager: EntityManager,
    cartItems: CartItemEntity[],
  ): Promise<PreparedOrderItem[]> {
    const preparedItems: PreparedOrderItem[] = [];

    for (const cartItem of cartItems) {
      /*
       * Validate quantity.
       */
      if (!Number.isInteger(cartItem.quantity) || cartItem.quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for SKU ${cartItem.skuId}`,
        );
      }

      /*
       * Load SKU.
       */
      const sku = await manager.findOne(ProductSkuEntity, {
        where: {
          id: cartItem.skuId,
        },
      });

      if (!sku || !sku.active) {
        throw new BadRequestException(`SKU ${cartItem.skuId} is unavailable`);
      }

      /*
       * Load product.
       */
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
       * DAY 74:
       * PostgreSQL SELECT ... FOR UPDATE.
       *
       * Lock is held until the checkout
       * transaction commits or rolls back.
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

      /*
       * Calculate available stock.
       */
      const availableQuantity = inventory.quantity - inventory.reservedQuantity;

      if (cartItem.quantity > availableQuantity) {
        throw new ConflictException(
          `Insufficient available stock for SKU ${sku.sku}`,
        );
      }

      /*
       * Price is taken from the database.
       */
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

  /**
   * Return an order with its items using the
   * current transaction manager.
   */
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
