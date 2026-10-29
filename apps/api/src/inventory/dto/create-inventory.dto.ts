import { ApiProperty } from '@nestjs/swagger';

export class CreateInventoryDto {
  @ApiProperty({
    example: 'SKU_ID_FROM_PRODUCT',
  })
  skuId!: string;

  @ApiProperty({
    example: 'TSHIRT-BLACK-M',
  })
  sku!: string;

  @ApiProperty({
    example: 100,
    minimum: 0,
  })
  quantity!: number;
}
