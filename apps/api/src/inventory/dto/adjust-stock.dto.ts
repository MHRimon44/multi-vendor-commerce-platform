import { ApiProperty } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({
    example: 20,
    description: 'Positive values add stock. Negative values remove stock.',
  })
  change!: number;

  @ApiProperty({
    example: 'WAREHOUSE_RESTOCK',
  })
  reason!: string;
}
