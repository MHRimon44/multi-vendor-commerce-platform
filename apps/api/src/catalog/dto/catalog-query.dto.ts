import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Matches(/^[1-9]\d*$/, {
    message: 'page must be a positive integer',
  })
  page?: string;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Matches(/^[1-9]\d*$/, {
    message: 'limit must be a positive integer',
  })
  limit?: string;

  @ApiPropertyOptional({
    example: 'shirt',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'vendor-a',
  })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({
    enum: ['name', 'createdAt'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt'])
  sortBy?: 'name' | 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
