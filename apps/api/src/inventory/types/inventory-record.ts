export interface InventoryRecord {
  id: string;
  vendorId: string;
  skuId: string;
  sku: string;

  quantity: number;
  reservedQuantity: number;

  createdAt: string;
  updatedAt: string;
}
