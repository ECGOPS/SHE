import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EntraService } from './entra.service';
import { EntraController } from './entra.controller';
import { EntraJwtStrategy } from './entra-jwt.strategy';
import { GraphService } from './graph.service';
import { EntraUserSyncService } from './entra-user-sync.service';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session.module';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [EntraService, EntraJwtStrategy, GraphService, EntraUserSyncService],
  controllers: [EntraController],
  exports: [EntraService, EntraJwtStrategy, GraphService, EntraUserSyncService],
})
export class EntraModule {}
