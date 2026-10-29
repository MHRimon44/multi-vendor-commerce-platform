import { ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
  })
  page?: string;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  limit?: string;

  @ApiPropertyOptional({
    example: 'shirt',
  })
  search?: string;

  @ApiPropertyOptional({
    example: 'vendor-a',
  })
  vendorId?: string;

  @ApiPropertyOptional({
    enum: ['name', 'createdAt'],
    example: 'createdAt',
  })
  sortBy?: 'name' | 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  sortOrder?: 'asc' | 'desc';
}
