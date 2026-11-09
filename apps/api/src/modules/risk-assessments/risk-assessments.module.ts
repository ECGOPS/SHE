import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskAssessment } from './entities/risk-assessment.entity';
import { RiskAssessmentsService } from './risk-assessments.service';
import { RiskAssessmentsController } from './risk-assessments.controller';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RiskAssessment, CorrectiveAction]),
    AuthModule,
    OrganizationsModule,
  ],
  providers: [RiskAssessmentsService],
  controllers: [RiskAssessmentsController],
})
export class RiskAssessmentsModule {}
