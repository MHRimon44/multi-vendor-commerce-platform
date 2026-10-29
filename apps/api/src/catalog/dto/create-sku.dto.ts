import { ApiProperty } from '@nestjs/swagger';

export class CreateSkuDto {
  @ApiProperty({
    example: 'TSHIRT-BLACK-M',
  })
  sku!: string;

  @ApiProperty({
    example: 'Black / Medium',
  })
  name!: string;

  @ApiProperty({
    example: 1499,
    minimum: 0,
  })
  price!: number;
}
