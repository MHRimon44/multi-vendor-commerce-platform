import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryAdjustmentEntity } from '../database/entities/inventory-adjustment.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';

import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryEntity)
    private readonly inventoryRepository: Repository<InventoryEntity>,

    @InjectRepository(InventoryAdjustmentEntity)
    private readonly adjustmentRepository: Repository<InventoryAdjustmentEntity>,
  ) {}

  async create(vendorId: string, dto: CreateInventoryDto) {
    if (dto.quantity < 0) {
      throw new BadRequestException('Initial quantity cannot be negative');
    }

    const existingInventory = await this.inventoryRepository.findOne({
      where: {
        skuId: dto.skuId,
      },
    });

    if (existingInventory) {
      throw new BadRequestException('Inventory already exists for this SKU');
    }

    const inventory = this.inventoryRepository.create({
      vendorId,
      skuId: dto.skuId,
      sku: dto.sku,
      quantity: dto.quantity,
      reservedQuantity: 0,
    });

    const savedInventory = await this.inventoryRepository.save(inventory);

    return this.withAvailability(savedInventory);
  }

  async findAll(vendorId?: string) {
    const inventories = await this.inventoryRepository.find({
      where: vendorId
        ? {
            vendorId,
          }
        : undefined,
      order: {
        createdAt: 'DESC',
      },
    });

    return inventories.map((inventory) => this.withAvailability(inventory));
  }

  async findOne(id: string, vendorId?: string) {
    const inventory = await this.inventoryRepository.findOne({
      where: vendorId
        ? {
            id,
            vendorId,
          }
        : {
            id,
          },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.withAvailability(inventory);
  }

  async findBySkuId(skuId: string) {
    const inventory = await this.inventoryRepository.findOne({
      where: {
        skuId,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.withAvailability(inventory);
  }

  async adjust(id: string, vendorId: string, dto: AdjustStockDto) {
    const inventory = await this.inventoryRepository.findOne({
      where: {
        id,
        vendorId,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    if (!Number.isFinite(dto.change)) {
      throw new BadRequestException('Stock change must be a valid number');
    }

    if (!dto.reason?.trim()) {
      throw new BadRequestException('Adjustment reason is required');
    }

    const quantityBefore = inventory.quantity;

    const quantityAfter = quantityBefore + dto.change;

    if (quantityAfter < 0) {
      throw new BadRequestException('Stock quantity cannot become negative');
    }

    if (quantityAfter < inventory.reservedQuantity) {
      throw new BadRequestException(
        'Quantity cannot be lower than reserved quantity',
      );
    }

    inventory.quantity = quantityAfter;

    const savedInventory = await this.inventoryRepository.save(inventory);

    const adjustment = this.adjustmentRepository.create({
      inventoryId: savedInventory.id,
      vendorId,
      skuId: savedInventory.skuId,
      change: dto.change,
      quantityBefore,
      quantityAfter,
      reason: dto.reason.trim(),
    });

    const savedAdjustment = await this.adjustmentRepository.save(adjustment);

    return {
      inventory: this.withAvailability(savedInventory),
      adjustment: savedAdjustment,
    };
  }

  async getHistory(id: string, vendorId: string) {
    const inventory = await this.inventoryRepository.findOne({
      where: {
        id,
        vendorId,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.adjustmentRepository.find({
      where: {
        inventoryId: id,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private withAvailability(inventory: InventoryEntity) {
    return {
      id: inventory.id,
      vendorId: inventory.vendorId,
      skuId: inventory.skuId,
      sku: inventory.sku,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity: inventory.quantity - inventory.reservedQuantity,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    };
  }
}
