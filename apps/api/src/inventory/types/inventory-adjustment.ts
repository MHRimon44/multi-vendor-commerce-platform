export interface InventoryAdjustment {
  id: string;
  inventoryId: string;
  vendorId: string;
  skuId: string;

  change: number;

  quantityBefore: number;
  quantityAfter: number;

  reason: string;

  createdAt: string;
}
