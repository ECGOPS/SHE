import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrectiveAction } from './entities/corrective-action.entity';
import { CorrectiveActionsService } from './corrective-actions.service';
import { CorrectiveActionsController } from './corrective-actions.controller';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import { AuditFinding } from '../audits/entities/audit-finding.entity';
import { AuditRecord } from '../audits/entities/audit-record.entity';
import { EnvironmentalEvent } from '../environmental/entities/environmental-event.entity';
import { JsaRecord } from '../jsa/entities/jsa.entity';
import { ManagementRecord } from '../management-system/entities/management-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CorrectiveAction,
      User,
      Incident,
      Hazard,
      NearMiss,
      Inspection,
      AuditFinding,
      AuditRecord,
      EnvironmentalEvent,
      JsaRecord,
      ManagementRecord,
    ]),
    AuthModule,
    OrganizationsModule,
    RealtimeModule,
    NotificationsModule,
  ],
  providers: [CorrectiveActionsService],
  controllers: [CorrectiveActionsController],
  exports: [CorrectiveActionsService],
})
export class CorrectiveActionsModule {}
