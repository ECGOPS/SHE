import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './database.config';
import { AuditColumnsSubscriber } from './audit-columns.subscriber';
import { AuditLogImmutableSubscriber } from '../modules/audit-trail/audit-log.immutable';
import { BootstrapService } from './bootstrap.service';
import { Region } from '../modules/organizations/entities/region.entity';
import { District } from '../modules/organizations/entities/district.entity';
import { User } from '../modules/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const opts = buildTypeOrmOptions(config);
        return { ...opts, subscribers: [AuditColumnsSubscriber, AuditLogImmutableSubscriber] };
      },
    }),
    TypeOrmModule.forFeature([Region, District, User]),
  ],
  providers: [AuditColumnsSubscriber, BootstrapService],
  exports: [AuditColumnsSubscriber],
})
export class DatabaseModule {}
