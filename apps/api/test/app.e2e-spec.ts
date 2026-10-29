import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

describe('Authentication and RBAC (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'day71-e2e-test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'Password123!',
      })
      .expect(201);

    return response.body.accessToken as string;
  }

  it('rejects a protected route without a token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'customer@example.com',
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('allows authenticated customer to access /auth/me', async () => {
    const token = await login('customer@example.com');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('denies customer access to admin resource', async () => {
    const token = await login('customer@example.com');

    await request(app.getHttpServer())
      .get('/auth/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows admin access to explicit admin resource', async () => {
    const token = await login('admin@example.com');

    await request(app.getHttpServer())
      .get('/auth/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('allows Vendor A to access Vendor A resource', async () => {
    const token = await login('vendor-a@example.com');

    await request(app.getHttpServer())
      .get('/auth/vendors/vendor-a')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('denies Vendor A access to Vendor B resource', async () => {
    const token = await login('vendor-a@example.com');

    await request(app.getHttpServer())
      .get('/auth/vendors/vendor-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('denies customer access to vendor resource', async () => {
    const token = await login('customer@example.com');

    await request(app.getHttpServer())
      .get('/auth/vendors/vendor-a')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows admin vendor access only when explicitly permitted', async () => {
    const token = await login('admin@example.com');

    await request(app.getHttpServer())
      .get('/auth/vendors/vendor-a')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
