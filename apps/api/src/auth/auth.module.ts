import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { VendorOwnershipGuard } from './guards/vendor-ownership.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }

        return {
          secret,
          signOptions: {
            expiresIn: '15m',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthenticationGuard,
    RolesGuard,
    VendorOwnershipGuard,
  ],
  exports: [
    AuthService,
    AuthenticationGuard,
    RolesGuard,
    VendorOwnershipGuard,
    JwtModule,
  ],
})
export class AuthModule {}
