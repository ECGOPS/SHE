import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './entities/incident.entity';
import { IncidentAttachment } from './entities/incident-attachment.entity';
import { Witness } from './entities/witness.entity';
import { InvestigationFinding } from './entities/investigation-finding.entity';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { User } from '../users/entities/user.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { NearMissAttachment } from '../near-miss/entities/near-miss-attachment.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident,
      IncidentAttachment,
      Witness,
      InvestigationFinding,
      User,
      NearMiss,
      NearMissAttachment,
      CorrectiveAction,
      IssueEscalation,
    ]),
    AuthModule,
    OrganizationsModule,
    RealtimeModule,
    NotificationsModule,
  ],
  providers: [IncidentsService],
  controllers: [IncidentsController],
  exports: [IncidentsService],
})
export class IncidentsModule {}
