import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CartEntity } from '../database/entities/cart.entity.js';
import { CartItemEntity } from '../database/entities/cart-item.entity.js';
import { InventoryEntity } from '../database/entities/inventory.entity.js';
import { ProductSkuEntity } from '../database/entities/product-sku.entity.js';

import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepository: Repository<CartEntity>,

    @InjectRepository(CartItemEntity)
    private readonly cartItemRepository: Repository<CartItemEntity>,

    @InjectRepository(ProductSkuEntity)
    private readonly skuRepository: Repository<ProductSkuEntity>,

    @InjectRepository(InventoryEntity)
    private readonly inventoryRepository: Repository<InventoryEntity>,
  ) {}

  async getCart(customerId: string) {
    const cart = await this.findOrCreateCart(customerId);

    return this.loadCart(cart.id);
  }

  async addItem(customerId: string, dto: AddCartItemDto) {
    await this.validateSkuAndStock(dto.skuId, dto.quantity);

    const cart = await this.findOrCreateCart(customerId);

    const existingItem = await this.cartItemRepository.findOne({
      where: {
        cartId: cart.id,
        skuId: dto.skuId,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + dto.quantity;

      await this.validateSkuAndStock(dto.skuId, newQuantity);

      existingItem.quantity = newQuantity;

      await this.cartItemRepository.save(existingItem);
    } else {
      const item = this.cartItemRepository.create({
        cartId: cart.id,
        skuId: dto.skuId,
        quantity: dto.quantity,
      });

      await this.cartItemRepository.save(item);
    }

    return this.loadCart(cart.id);
  }

  async updateItem(customerId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.findCartByCustomer(customerId);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.cartItemRepository.findOne({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.validateSkuAndStock(item.skuId, dto.quantity);

    item.quantity = dto.quantity;

    await this.cartItemRepository.save(item);

    return this.loadCart(cart.id);
  }

  async removeItem(customerId: string, itemId: string) {
    const cart = await this.findCartByCustomer(customerId);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.cartItemRepository.findOne({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(item);

    return this.loadCart(cart.id);
  }

  async clearCart(customerId: string) {
    const cart = await this.findCartByCustomer(customerId);

    if (!cart) {
      return {
        message: 'Cart is already empty',
      };
    }

    await this.cartItemRepository.delete({
      cartId: cart.id,
    });

    return this.loadCart(cart.id);
  }

  async getValidatedCartForCheckout(customerId: string) {
    const cart = await this.findCartByCustomer(customerId);

    if (!cart) {
      throw new BadRequestException('Cart is empty');
    }

    const loadedCart = await this.loadCart(cart.id);

    if (loadedCart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    for (const item of loadedCart.items) {
      await this.validateSkuAndStock(item.skuId, item.quantity);
    }

    return loadedCart;
  }

  private async findOrCreateCart(customerId: string) {
    const existing = await this.findCartByCustomer(customerId);

    if (existing) {
      return existing;
    }

    const cart = this.cartRepository.create({
      customerId,
    });

    return this.cartRepository.save(cart);
  }

  private findCartByCustomer(customerId: string) {
    return this.cartRepository.findOne({
      where: {
        customerId,
      },
    });
  }

  private async loadCart(cartId: string) {
    const cart = await this.cartRepository.findOne({
      where: {
        id: cartId,
      },
      relations: {
        items: true,
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  private async validateSkuAndStock(skuId: string, requestedQuantity: number) {
    const sku = await this.skuRepository.findOne({
      where: {
        id: skuId,
        active: true,
      },
    });

    if (!sku) {
      throw new NotFoundException('SKU not found');
    }

    const inventory = await this.inventoryRepository.findOne({
      where: {
        skuId,
      },
    });

    if (!inventory) {
      throw new BadRequestException('Inventory not found for SKU');
    }

    const availableQuantity = inventory.quantity - inventory.reservedQuantity;

    if (requestedQuantity > availableQuantity) {
      throw new BadRequestException(
        'Requested quantity exceeds available stock',
      );
    }

    return {
      sku,
      inventory,
      availableQuantity,
    };
  }
}
