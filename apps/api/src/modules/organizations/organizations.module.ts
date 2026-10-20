import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Region } from './entities/region.entity';
import { District } from './entities/district.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsAdminService } from './organizations-admin.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Region, District])],
  providers: [OrganizationsService, OrganizationsAdminService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService, TypeOrmModule],
})
export class OrganizationsModule {}
