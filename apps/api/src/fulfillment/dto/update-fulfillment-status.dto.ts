import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { VendorFulfillmentStatus } from '../../database/entities/vendor-order.entity.js';

export class UpdateFulfillmentStatusDto {
  @ApiProperty({
    enum: VendorFulfillmentStatus,
    example: VendorFulfillmentStatus.PACKED,
  })
  @IsEnum(VendorFulfillmentStatus)
  status!: VendorFulfillmentStatus;

  @ApiPropertyOptional({
    example: 'Items packed and ready for shipment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
