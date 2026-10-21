import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RbacScopeService } from './rbac-scope.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { UsersModule } from '../users/users.module';
import { EntraModule } from './entra/entra.module';
import { SessionModule } from './session.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as StringValue },
      }),
    }),
    UsersModule,
    SessionModule,
    EntraModule,
  ],
  providers: [AuthService, JwtStrategy, RbacScopeService, CryptoService],
  controllers: [AuthController],
  exports: [AuthService, RbacScopeService, CryptoService, EntraModule],
})
export class AuthModule {}
