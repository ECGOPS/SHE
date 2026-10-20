import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inspection } from './entities/inspection.entity';
import { InspectionAttachment } from './entities/inspection-attachment.entity';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, InspectionAttachment, CorrectiveAction, Hazard]), AuthModule, OrganizationsModule],
  providers: [InspectionsService],
  controllers: [InspectionsController],
})
export class InspectionsModule {}
