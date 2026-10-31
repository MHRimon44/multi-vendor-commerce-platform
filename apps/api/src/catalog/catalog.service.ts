import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { ProductEntity } from '../database/entities/product.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';

import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @InjectRepository(ProductSkuEntity)
    private readonly skuRepository: Repository<ProductSkuEntity>,
  ) {}

  async create(
    vendorId: string,
    dto: CreateProductDto,
  ): Promise<ProductEntity> {
    await this.ensureSkuUniqueness(dto.skus.map((item) => item.sku));

    const product = this.productRepository.create({
      vendorId,
      name: dto.name,
      description: dto.description ?? '',
      active: true,

      skus: dto.skus.map((item) =>
        this.skuRepository.create({
          sku: item.sku,
          name: item.name,
          price: item.price,
          active: true,
        }),
      ),
    });

    return this.productRepository.save(product);
  }

  async findAll(query: CatalogQueryDto) {
    const page = Math.max(Number(query.page ?? 1), 1);

    const requestedLimit = Number(query.limit ?? 10);

    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    const sortBy = query.sortBy ?? 'createdAt';

    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.skus', 'sku')
      .where('product.active = :active', {
        active: true,
      });

    if (query.vendorId) {
      queryBuilder.andWhere('product.vendorId = :vendorId', {
        vendorId: query.vendorId,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        `(
          LOWER(product.name)
            LIKE LOWER(:search)
          OR
          LOWER(product.description)
            LIKE LOWER(:search)
          OR
          LOWER(sku.sku)
            LIKE LOWER(:search)
        )`,
        {
          search: `%${query.search}%`,
        },
      );
    }

    queryBuilder.orderBy(`product.${sortBy}`, sortOrder);

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: {
        id,
        active: true,
      },
      relations: {
        skus: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(
    id: string,
    vendorId: string,
    dto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await this.findOne(id);

    if (product.vendorId !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    if (dto.skus) {
      await this.ensureSkuUniqueness(
        dto.skus.map((item) => item.sku),
        product.id,
      );

      await this.skuRepository.delete({
        productId: product.id,
      });

      product.skus = dto.skus.map((item) =>
        this.skuRepository.create({
          productId: product.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          active: true,
        }),
      );
    }

    if (dto.name !== undefined) {
      product.name = dto.name;
    }

    if (dto.description !== undefined) {
      product.description = dto.description;
    }

    return this.productRepository.save(product);
  }

  async remove(id: string, vendorId: string): Promise<void> {
    const product = await this.findOne(id);

    if (product.vendorId !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    product.active = false;

    await this.productRepository.save(product);
  }

  async findSku(skuId: string): Promise<ProductSkuEntity> {
    const sku = await this.skuRepository.findOne({
      where: {
        id: skuId,
        active: true,
      },
      relations: {
        product: true,
      },
    });

    if (!sku) {
      throw new NotFoundException('SKU not found');
    }

    return sku;
  }

  private async ensureSkuUniqueness(
    incomingSkus: string[],
    excludedProductId?: string,
  ): Promise<void> {
    const normalized = incomingSkus.map((sku) => sku.trim().toLowerCase());

    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('SKU must be unique');
    }

    for (const sku of incomingSkus) {
      const existing = await this.skuRepository.findOne({
        where: {
          sku: ILike(sku.trim()),
        },
      });

      if (existing && existing.productId !== excludedProductId) {
        throw new BadRequestException(`SKU already exists: ${sku}`);
      }
    }
  }
}
