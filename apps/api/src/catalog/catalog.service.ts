import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product } from './types/product.js';
import { ProductSku } from './types/product-sku.js';

@Injectable()
export class CatalogService {
  private readonly products: Product[] = [];

  create(vendorId: string, dto: CreateProductDto): Product {
    this.ensureSkuUniqueness(dto.skus.map((item) => item.sku));

    const now = new Date().toISOString();
    const productId = randomUUID();

    const skus: ProductSku[] = dto.skus.map((item) => ({
      id: randomUUID(),
      productId,
      sku: item.sku,
      name: item.name,
      price: item.price,
      active: true,
      createdAt: now,
      updatedAt: now,
    }));

    const product: Product = {
      id: productId,
      vendorId,
      name: dto.name,
      description: dto.description ?? '',
      active: true,
      createdAt: now,
      updatedAt: now,
      skus,
    };

    this.products.push(product);

    return product;
  }

  findAll(query: CatalogQueryDto) {
    const page = Math.max(Number(query.page ?? 1), 1);

    const requestedLimit = Number(query.limit ?? 10);

    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    let products = [...this.products];

    if (query.vendorId) {
      products = products.filter(
        (product) => product.vendorId === query.vendorId,
      );
    }

    if (query.search) {
      const search = query.search.toLowerCase();

      products = products.filter(
        (product) =>
          product.name.toLowerCase().includes(search) ||
          product.description.toLowerCase().includes(search) ||
          product.skus.some((sku) => sku.sku.toLowerCase().includes(search)),
      );
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const direction = query.sortOrder === 'asc' ? 1 : -1;

    products.sort((a, b) => {
      return a[sortBy].localeCompare(b[sortBy]) * direction;
    });

    const total = products.length;
    const start = (page - 1) * limit;

    return {
      data: products.slice(start, start + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  findOne(id: string): Product {
    const product = this.products.find((item) => item.id === id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  update(id: string, vendorId: string, dto: UpdateProductDto): Product {
    const product = this.findOne(id);

    if (product.vendorId !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    if (dto.skus) {
      this.ensureSkuUniqueness(
        dto.skus.map((item) => item.sku),
        id,
      );

      product.skus = dto.skus.map((item) => ({
        id: randomUUID(),
        productId: product.id,
        sku: item.sku,
        name: item.name,
        price: item.price,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    if (dto.name !== undefined) {
      product.name = dto.name;
    }

    if (dto.description !== undefined) {
      product.description = dto.description;
    }

    product.updatedAt = new Date().toISOString();

    return product;
  }

  remove(id: string, vendorId: string): void {
    const product = this.findOne(id);

    if (product.vendorId !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    product.active = false;
    product.updatedAt = new Date().toISOString();
  }

  private ensureSkuUniqueness(
    incomingSkus: string[],
    excludedProductId?: string,
  ): void {
    const normalized = incomingSkus.map((sku) => sku.trim().toLowerCase());

    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('SKU must be unique');
    }

    const existingSkus = this.products
      .filter((product) => product.id !== excludedProductId)
      .flatMap((product) => product.skus)
      .map((sku) => sku.sku.trim().toLowerCase());

    const duplicate = normalized.some((sku) => existingSkus.includes(sku));

    if (duplicate) {
      throw new BadRequestException('SKU already exists');
    }
  }
}
