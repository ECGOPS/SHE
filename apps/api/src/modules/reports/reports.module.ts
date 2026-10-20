import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AuthModule } from '../auth/auth.module';
import { Incident } from '../incidents/entities/incident.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { JsaRecord } from '../jsa/entities/jsa.entity';
import { Permit } from '../ptw/entities/permit.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import { AuditRecord } from '../audits/entities/audit-record.entity';
import { EnvironmentalEvent } from '../environmental/entities/environmental-event.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { TrainingAttendance } from '../training/entities/training.entity';
import { HealthRecord } from '../health/entities/health-record.entity';
import { PpeIssuance, PpeItem } from '../ppe/entities/ppe.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident,
      NearMiss,
      Hazard,
      JsaRecord,
      Permit,
      Inspection,
      AuditRecord,
      EnvironmentalEvent,
      CorrectiveAction,
      TrainingAttendance,
      HealthRecord,
      PpeIssuance,
      PpeItem,
    ]),
    AuthModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
