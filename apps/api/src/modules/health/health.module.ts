import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthRecord } from './entities/health-record.entity';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HealthRecord, User]), AuthModule, OrganizationsModule],
  providers: [HealthService],
  controllers: [HealthController],
})
export class HealthModule {}
