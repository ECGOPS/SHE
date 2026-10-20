import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagementRecord } from './entities/management-record.entity';
import { ManagementSystemService } from './management-system.service';
import { ManagementSystemController } from './management-system.controller';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [TypeOrmModule.forFeature([ManagementRecord]), AuthModule, OrganizationsModule],
  providers: [ManagementSystemService],
  controllers: [ManagementSystemController],
})
export class ManagementSystemModule {}
