import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function createTypeOrmConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',

    host: configService.getOrThrow<string>('DB_HOST'),

    port: Number(configService.getOrThrow<string>('DB_PORT')),

    username: configService.getOrThrow<string>('DB_USERNAME'),

    password: configService.getOrThrow<string>('DB_PASSWORD'),

    database: configService.getOrThrow<string>('DB_DATABASE'),

    autoLoadEntities: true,

    synchronize: true,

    logging: false,
  };
}
