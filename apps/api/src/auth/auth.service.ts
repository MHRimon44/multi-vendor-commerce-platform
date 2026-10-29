import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './types/jwt-payload.js';
import { UserRole } from './types/user-role.js';

interface DemoUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  vendorId?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private users: DemoUser[] = [];

  constructor(private readonly jwtService: JwtService) {}

  async onModuleInit(): Promise<void> {
    /*
     * Temporary demo identities for Day 71.
     *
     * These will be replaced by PostgreSQL-backed users when
     * persistence is integrated into the project.
     */

    const passwordHash = await bcrypt.hash('Password123!', 12);

    this.users = [
      {
        id: 'customer-1',
        email: 'customer@example.com',
        passwordHash,
        role: UserRole.CUSTOMER,
      },
      {
        id: 'vendor-a-user',
        email: 'vendor-a@example.com',
        passwordHash,
        role: UserRole.VENDOR_STAFF,
        vendorId: 'vendor-a',
      },
      {
        id: 'vendor-b-user',
        email: 'vendor-b@example.com',
        passwordHash,
        role: UserRole.VENDOR_STAFF,
        vendorId: 'vendor-b',
      },
      {
        id: 'admin-1',
        email: 'admin@example.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    ];
  }

  async login(loginDto: LoginDto) {
    const user = this.users.find((item) => item.email === loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(user.vendorId ? { vendorId: user.vendorId } : {}),
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        ...(user.vendorId ? { vendorId: user.vendorId } : {}),
      },
    };
  }
}
