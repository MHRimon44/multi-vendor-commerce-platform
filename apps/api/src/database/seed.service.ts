import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { CatalogService } from '../catalog/catalog.service.js';
import { InventoryService } from '../inventory/inventory.service.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
  ) {}

  onApplicationBootstrap(): void {
    this.seed();
  }
  private seedProduct(
    vendorId: string,
    productData: {
      name: string;
      description: string;
      skus: {
        sku: string;
        name: string;
        price: number;
      }[];
    },
  ): void {
    const existingProducts = this.catalogService.findAll({
      page: '1',
      limit: '50',
    });

    const exists = existingProducts.data.some(
      (product) =>
        product.vendorId === vendorId && product.name === productData.name,
    );

    if (exists) {
      return;
    }

    const product = this.catalogService.create(vendorId, productData);

    for (const sku of product.skus) {
      this.inventoryService.create(vendorId, {
        skuId: sku.id,
        sku: sku.sku,
        quantity: 100,
      });
    }
  }
  private seed(): void {
    console.log('🌱 DAY 72 SEED SERVICE IS RUNNING');

    this.seedProduct('vendor-a', {
      name: 'Classic Cotton T-Shirt',
      description: 'Premium cotton everyday T-shirt',
      skus: [
        {
          sku: 'TSHIRT-BLACK-M',
          name: 'Black / Medium',
          price: 1499,
        },
        {
          sku: 'TSHIRT-BLACK-L',
          name: 'Black / Large',
          price: 1499,
        },
      ],
    });

    this.seedProduct('vendor-a', {
      name: 'Slim Fit Denim',
      description: 'Classic slim fit denim jeans',
      skus: [
        {
          sku: 'DENIM-BLUE-32',
          name: 'Blue / 32',
          price: 2499,
        },
      ],
    });

    this.seedProduct('vendor-b', {
      name: 'Running Sneakers',
      description: 'Lightweight everyday running sneakers',
      skus: [
        {
          sku: 'SNEAKER-WHITE-42',
          name: 'White / 42',
          price: 3299,
        },
        {
          sku: 'SNEAKER-BLACK-42',
          name: 'Black / 42',
          price: 3299,
        },
      ],
    });
  }
}
