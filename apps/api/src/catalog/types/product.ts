import { ProductSku } from './product-sku.js';

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  skus: ProductSku[];
}
