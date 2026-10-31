import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module.js';
import { CartEntity } from '../src/database/entities/cart.entity.js';
import { CartItemEntity } from '../src/database/entities/cart-item.entity.js';
import { InventoryEntity } from '../src/database/entities/inventory.entity.js';
import {
  InventoryReservationEntity,
  InventoryReservationStatus,
} from '../src/database/entities/inventory-reservation.entity.js';
import {
  OrderEntity,
  OrderStatus,
} from '../src/database/entities/order.entity.js';
import { ProductSkuEntity } from '../src/database/entities/product-sku.entity.js';
import { OrdersService } from '../src/orders/orders.service.js';

describe('Inventory concurrency (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let ordersService: OrdersService;

  let customerId: string;

  const secondCustomerId = 'day74-customer-2';

  let sku: ProductSkuEntity;
  let inventory: InventoryEntity;

  let originalQuantity: number;
  let originalReservedQuantity: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'day74-concurrency-e2e-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    dataSource = app.get(DataSource);

    ordersService = app.get(OrdersService);

    /*
     * We only need the seeded customer ID here.
     *
     * Authentication itself is already covered by
     * the auth E2E suite.
     */
    customerId = 'customer-1';

    const skuRepository = dataSource.getRepository(ProductSkuEntity);

    const foundSku = await skuRepository.findOne({
      where: {
        sku: 'TSHIRT-BLACK-M',
      },
    });

    if (!foundSku) {
      throw new Error('Test SKU TSHIRT-BLACK-M was not found');
    }

    sku = foundSku;

    const inventoryRepository = dataSource.getRepository(InventoryEntity);

    const foundInventory = await inventoryRepository.findOne({
      where: {
        skuId: sku.id,
      },
    });

    if (!foundInventory) {
      throw new Error('Inventory for test SKU was not found');
    }

    inventory = foundInventory;

    originalQuantity = inventory.quantity;

    originalReservedQuantity = inventory.reservedQuantity;
  });

  beforeEach(async () => {
    await cleanTestData();

    await setInventoryState(1, 0);
  });

  afterEach(async () => {
    await cleanTestData();

    await setInventoryState(originalQuantity, originalReservedQuantity);
  });

  afterAll(async () => {
    await cleanTestData();

    await setInventoryState(originalQuantity, originalReservedQuantity);

    await app.close();
  });

  async function setInventoryState(
    quantity: number,
    reservedQuantity: number,
  ): Promise<void> {
    const inventoryRepository = dataSource.getRepository(InventoryEntity);

    const currentInventory = await inventoryRepository.findOneByOrFail({
      id: inventory.id,
    });

    currentInventory.quantity = quantity;

    currentInventory.reservedQuantity = reservedQuantity;

    await inventoryRepository.save(currentInventory);

    inventory = currentInventory;
  }

  async function cleanCustomerData(targetCustomerId: string): Promise<void> {
    const reservationRepository = dataSource.getRepository(
      InventoryReservationEntity,
    );

    const orderRepository = dataSource.getRepository(OrderEntity);

    const cartRepository = dataSource.getRepository(CartEntity);

    const cartItemRepository = dataSource.getRepository(CartItemEntity);

    /*
     * Delete reservations before orders.
     */
    const orders = await orderRepository.find({
      where: {
        customerId: targetCustomerId,
      },
    });

    for (const order of orders) {
      await reservationRepository.delete({
        orderId: order.id,
      });
    }

    await orderRepository.delete({
      customerId: targetCustomerId,
    });

    /*
     * Delete cart items before carts.
     */
    const carts = await cartRepository.find({
      where: {
        customerId: targetCustomerId,
      },
    });

    for (const cart of carts) {
      await cartItemRepository.delete({
        cartId: cart.id,
      });
    }

    await cartRepository.delete({
      customerId: targetCustomerId,
    });
  }

  async function cleanTestData(): Promise<void> {
    await cleanCustomerData(customerId);

    await cleanCustomerData(secondCustomerId);
  }

  async function createCart(
    customerIdForCart: string,
    quantity = 1,
  ): Promise<CartEntity> {
    const cartRepository = dataSource.getRepository(CartEntity);

    const cartItemRepository = dataSource.getRepository(CartItemEntity);

    const cart = await cartRepository.save(
      cartRepository.create({
        customerId: customerIdForCart,
      }),
    );

    await cartItemRepository.save(
      cartItemRepository.create({
        cartId: cart.id,
        skuId: sku.id,
        quantity,
      }),
    );

    return cart;
  }

  it('prevents two concurrent checkouts from overselling one available unit', async () => {
    /*
     * Only one physical unit is available.
     */
    await setInventoryState(1, 0);

    await createCart(customerId, 1);

    await createCart(secondCustomerId, 1);

    /*
     * Start both checkout operations without
     * awaiting either one first.
     */
    const firstCheckout = ordersService.checkout(customerId);

    const secondCheckout = ordersService.checkout(secondCustomerId);

    const results = await Promise.allSettled([firstCheckout, secondCheckout]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');

    const rejected = results.filter((result) => result.status === 'rejected');

    /*
     * Exactly one checkout must win.
     */
    expect(fulfilled).toHaveLength(1);

    /*
     * Exactly one checkout must lose.
     */
    expect(rejected).toHaveLength(1);

    /*
     * Verify the rejected checkout returned
     * our explicit stock conflict.
     */
    const rejectedResult = rejected[0];

    if (!rejectedResult || rejectedResult.status !== 'rejected') {
      throw new Error('Expected one rejected checkout');
    }

    expect(rejectedResult.reason).toBeInstanceOf(ConflictException);

    /*
     * Re-read inventory from PostgreSQL.
     */
    const freshInventory = await dataSource
      .getRepository(InventoryEntity)
      .findOneByOrFail({
        id: inventory.id,
      });

    expect(freshInventory.quantity).toBe(1);

    expect(freshInventory.reservedQuantity).toBe(1);

    expect(freshInventory.quantity - freshInventory.reservedQuantity).toBe(0);

    /*
     * Physical inventory invariant.
     */
    expect(freshInventory.reservedQuantity).toBeLessThanOrEqual(
      freshInventory.quantity,
    );

    /*
     * Only one reservation may exist.
     */
    const reservations = await dataSource
      .getRepository(InventoryReservationEntity)
      .find({
        where: {
          skuId: sku.id,
          status: InventoryReservationStatus.ACTIVE,
        },
      });

    expect(reservations).toHaveLength(1);

    expect(reservations[0]?.quantity).toBe(1);

    /*
     * Only one order should exist across
     * the two competing customers.
     */
    const orderRepository = dataSource.getRepository(OrderEntity);

    const customerOneOrders = await orderRepository.count({
      where: {
        customerId,
      },
    });

    const customerTwoOrders = await orderRepository.count({
      where: {
        customerId: secondCustomerId,
      },
    });

    expect(customerOneOrders + customerTwoOrders).toBe(1);
  });

  it('releases an active reservation when a pending order is cancelled', async () => {
    /*
     * Give the SKU enough inventory.
     */
    await setInventoryState(5, 0);

    /*
     * Customer wants two units.
     */
    await createCart(customerId, 2);

    const order = await ordersService.checkout(customerId);

    /*
     * Verify checkout created an ACTIVE
     * reservation.
     */
    let freshInventory = await dataSource
      .getRepository(InventoryEntity)
      .findOneByOrFail({
        id: inventory.id,
      });

    expect(freshInventory.quantity).toBe(5);

    expect(freshInventory.reservedQuantity).toBe(2);

    expect(freshInventory.quantity - freshInventory.reservedQuantity).toBe(3);

    const reservationRepository = dataSource.getRepository(
      InventoryReservationEntity,
    );

    const activeReservation = await reservationRepository.findOne({
      where: {
        orderId: order.id,
        status: InventoryReservationStatus.ACTIVE,
      },
    });

    expect(activeReservation).not.toBeNull();

    expect(activeReservation!.quantity).toBe(2);

    expect(activeReservation!.releasedAt).toBeNull();

    /*
     * Cancel the pending order.
     */
    const cancelledOrder = await ordersService.cancelOrder(
      customerId,
      order.id,
    );

    expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);

    /*
     * Reservation must be released.
     */
    freshInventory = await dataSource
      .getRepository(InventoryEntity)
      .findOneByOrFail({
        id: inventory.id,
      });

    expect(freshInventory.quantity).toBe(5);

    expect(freshInventory.reservedQuantity).toBe(0);

    expect(freshInventory.quantity - freshInventory.reservedQuantity).toBe(5);

    /*
     * Reservation history remains in DB.
     * We do not delete it during cancellation.
     */
    const releasedReservation = await reservationRepository.findOne({
      where: {
        orderId: order.id,
      },
    });

    expect(releasedReservation).not.toBeNull();

    expect(releasedReservation!.status).toBe(
      InventoryReservationStatus.RELEASED,
    );

    expect(releasedReservation!.releasedAt).not.toBeNull();

    /*
     * Order itself must also be persisted
     * as CANCELLED.
     */
    const persistedOrder = await dataSource
      .getRepository(OrderEntity)
      .findOneByOrFail({
        id: order.id,
      });

    expect(persistedOrder.status).toBe(OrderStatus.CANCELLED);
  });

  it('rejects a second cancellation and does not release inventory twice', async () => {
    await setInventoryState(5, 0);

    await createCart(customerId, 2);

    const order = await ordersService.checkout(customerId);

    await ordersService.cancelOrder(customerId, order.id);

    /*
     * Second cancellation must fail.
     */
    await expect(
      ordersService.cancelOrder(customerId, order.id),
    ).rejects.toBeInstanceOf(ConflictException);

    /*
     * Inventory must remain valid.
     *
     * It must NOT become -2 reserved.
     */
    const freshInventory = await dataSource
      .getRepository(InventoryEntity)
      .findOneByOrFail({
        id: inventory.id,
      });

    expect(freshInventory.reservedQuantity).toBe(0);

    expect(freshInventory.quantity).toBe(5);
  });
});
