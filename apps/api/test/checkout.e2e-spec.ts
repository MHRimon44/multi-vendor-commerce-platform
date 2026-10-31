import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { CartItemEntity } from '../src/database/entities/cart-item.entity.js';
import { CartEntity } from '../src/database/entities/cart.entity.js';
import { OrderItemEntity } from '../src/database/entities/order-item.entity.js';
import { OrderEntity } from '../src/database/entities/order.entity.js';
import { ProductSkuEntity } from '../src/database/entities/product-sku.entity.js';

describe('Transactional checkout (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let customerToken: string;
  let customerId: string;
  let sku: ProductSkuEntity;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'day73-checkout-e2e-test-secret';

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

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'customer@example.com',
        password: 'Password123!',
      })
      .expect(201);

    customerToken = loginResponse.body.accessToken as string;

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    customerId = meResponse.body.user.id as string;
    const skuRepository = dataSource.getRepository(ProductSkuEntity);

    const foundSku = await skuRepository.findOne({
      where: {
        sku: 'TSHIRT-BLACK-M',
      },
    });

    if (!foundSku) {
      throw new Error('Seeded test SKU TSHIRT-BLACK-M was not found');
    }

    sku = foundSku;
  });

  beforeEach(async () => {
    await removeRollbackTrigger();

    await cleanCustomerCheckoutData();
  });

  afterEach(async () => {
    await removeRollbackTrigger();
  });

  afterAll(async () => {
    await removeRollbackTrigger();

    await cleanCustomerCheckoutData();

    await app.close();
  });

  async function cleanCustomerCheckoutData() {
    const cartRepository = dataSource.getRepository(CartEntity);

    const orderRepository = dataSource.getRepository(OrderEntity);

    const carts = await cartRepository.find({
      where: {
        customerId,
      },
    });

    for (const cart of carts) {
      await dataSource.getRepository(CartItemEntity).delete({
        cartId: cart.id,
      });
    }

    await cartRepository.delete({
      customerId,
    });

    await orderRepository.delete({
      customerId,
    });
  }

  async function addItemToCart(quantity: number) {
    return request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        skuId: sku.id,
        quantity,
      })
      .expect(201);
  }

  async function installRollbackTrigger() {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION
      day73_force_order_item_failure()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION
          'DAY73_FORCED_ORDER_ITEM_FAILURE';
      END;
      $$;
    `);

    await dataSource.query(`
      CREATE TRIGGER
      day73_order_item_failure_trigger
      BEFORE INSERT ON order_items
      FOR EACH ROW
      EXECUTE FUNCTION
      day73_force_order_item_failure();
    `);
  }

  async function removeRollbackTrigger() {
    await dataSource.query(`
      DROP TRIGGER IF EXISTS
      day73_order_item_failure_trigger
      ON order_items;
    `);

    await dataSource.query(`
      DROP FUNCTION IF EXISTS
      day73_force_order_item_failure();
    `);
  }

  it('creates order with server-calculated price snapshots and clears cart', async () => {
    await addItemToCart(2);

    const checkoutResponse = await request(app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    expect(checkoutResponse.body.customerId).toBe(customerId);

    expect(checkoutResponse.body.totalAmount).toBe(sku.price * 2);

    expect(checkoutResponse.body.items).toHaveLength(1);

    expect(checkoutResponse.body.items[0].skuId).toBe(sku.id);

    expect(checkoutResponse.body.items[0].unitPrice).toBe(sku.price);

    expect(checkoutResponse.body.items[0].quantity).toBe(2);

    expect(checkoutResponse.body.items[0].lineTotal).toBe(sku.price * 2);

    const orderRepository = dataSource.getRepository(OrderEntity);

    const orderItemRepository = dataSource.getRepository(OrderItemEntity);

    const cartRepository = dataSource.getRepository(CartEntity);

    const cartItemRepository = dataSource.getRepository(CartItemEntity);

    expect(
      await orderRepository.count({
        where: {
          customerId,
        },
      }),
    ).toBe(1);

    expect(
      await orderItemRepository.count({
        where: {
          orderId: checkoutResponse.body.id as string,
        },
      }),
    ).toBe(1);

    const cart = await cartRepository.findOne({
      where: {
        customerId,
      },
    });

    expect(cart).not.toBeNull();

    expect(
      await cartItemRepository.count({
        where: {
          cartId: cart!.id,
        },
      }),
    ).toBe(0);
  });

  it('rolls back order creation when order-item insertion fails', async () => {
    await addItemToCart(2);

    const orderRepository = dataSource.getRepository(OrderEntity);

    const orderItemRepository = dataSource.getRepository(OrderItemEntity);

    const cartRepository = dataSource.getRepository(CartEntity);

    const cartItemRepository = dataSource.getRepository(CartItemEntity);

    const ordersBefore = await orderRepository.count({
      where: {
        customerId,
      },
    });

    const orderItemsBefore = await orderItemRepository.count();

    const cart = await cartRepository.findOne({
      where: {
        customerId,
      },
    });

    if (!cart) {
      throw new Error('Test cart was not created');
    }

    const cartItemsBefore = await cartItemRepository.count({
      where: {
        cartId: cart.id,
      },
    });

    expect(cartItemsBefore).toBe(1);

    await installRollbackTrigger();

    await request(app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(500);

    await removeRollbackTrigger();

    const ordersAfter = await orderRepository.count({
      where: {
        customerId,
      },
    });

    const orderItemsAfter = await orderItemRepository.count();

    const cartItemsAfter = await cartItemRepository.count({
      where: {
        cartId: cart.id,
      },
    });

    expect(ordersAfter).toBe(ordersBefore);

    expect(orderItemsAfter).toBe(orderItemsBefore);

    expect(cartItemsAfter).toBe(cartItemsBefore);
  });
});
