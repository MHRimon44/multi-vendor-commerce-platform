import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'vendor-a@example.com',
  })
  email!: string;

  @ApiProperty({
    example: 'Password123!',
  })
  password!: string;
}
