import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permit } from './entities/permit.entity';
import { PtwService } from './ptw.service';
import { PtwController } from './ptw.controller';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TrainingModule } from '../training/training.module';
import { PpeModule } from '../ppe/ppe.module';

@Module({
  imports: [TypeOrmModule.forFeature([Permit, User]), AuthModule, OrganizationsModule, TrainingModule, PpeModule],
  providers: [PtwService],
  controllers: [PtwController],
})
export class PtwModule {}
