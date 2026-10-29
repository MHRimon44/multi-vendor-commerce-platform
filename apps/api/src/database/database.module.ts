import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [CatalogModule, InventoryModule],
  providers: [SeedService],
})
export class DatabaseModule {}
