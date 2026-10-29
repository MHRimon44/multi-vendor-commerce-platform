import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';

import { InventoryAdjustment } from './types/inventory-adjustment.js';
import { InventoryRecord } from './types/inventory-record.js';

@Injectable()
export class InventoryService {
  private readonly inventories: InventoryRecord[] = [];

  private readonly adjustments: InventoryAdjustment[] = [];

  create(vendorId: string, dto: CreateInventoryDto) {
    if (dto.quantity < 0) {
      throw new BadRequestException('Initial quantity cannot be negative');
    }

    const existingInventory = this.inventories.find(
      (inventory) => inventory.skuId === dto.skuId,
    );

    if (existingInventory) {
      throw new BadRequestException('Inventory already exists for this SKU');
    }

    const now = new Date().toISOString();

    const inventory: InventoryRecord = {
      id: randomUUID(),
      vendorId,
      skuId: dto.skuId,
      sku: dto.sku,
      quantity: dto.quantity,
      reservedQuantity: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.inventories.push(inventory);

    return this.withAvailability(inventory);
  }

  findAll(vendorId?: string) {
    const inventories = vendorId
      ? this.inventories.filter((inventory) => inventory.vendorId === vendorId)
      : this.inventories;

    return inventories.map((inventory) => this.withAvailability(inventory));
  }

  findOne(id: string) {
    const inventory = this.inventories.find((item) => item.id === id);

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.withAvailability(inventory);
  }

  adjust(id: string, vendorId: string, dto: AdjustStockDto) {
    const inventory = this.inventories.find((item) => item.id === id);

    if (!inventory || inventory.vendorId !== vendorId) {
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
    inventory.updatedAt = new Date().toISOString();

    const adjustment: InventoryAdjustment = {
      id: randomUUID(),
      inventoryId: inventory.id,
      vendorId,
      skuId: inventory.skuId,
      change: dto.change,
      quantityBefore,
      quantityAfter,
      reason: dto.reason.trim(),
      createdAt: new Date().toISOString(),
    };

    this.adjustments.push(adjustment);

    return {
      inventory: this.withAvailability(inventory),
      adjustment,
    };
  }

  getHistory(id: string, vendorId: string) {
    const inventory = this.inventories.find((item) => item.id === id);

    if (!inventory || inventory.vendorId !== vendorId) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.adjustments
      .filter((adjustment) => adjustment.inventoryId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private withAvailability(inventory: InventoryRecord) {
    return {
      ...inventory,

      availableQuantity: inventory.quantity - inventory.reservedQuantity,
    };
  }
}
