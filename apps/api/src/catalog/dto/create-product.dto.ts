import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CreateSkuDto } from './create-sku.dto.js';

export class CreateProductDto {
  @ApiProperty({
    example: 'Classic Cotton T-Shirt',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'Premium cotton everyday T-shirt',
  })
  description?: string;

  @ApiProperty({
    type: [CreateSkuDto],
  })
  skus!: CreateSkuDto[];
}
