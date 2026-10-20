import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueEscalation } from './entities/issue-escalation.entity';
import { EscalationsService } from './escalations.service';
import { EscalationsController } from './escalations.controller';
import { Incident } from '../incidents/entities/incident.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IssueEscalation, Incident, Hazard, NearMiss, CorrectiveAction]),
    AuthModule,
    NotificationsModule,
  ],
  providers: [EscalationsService],
  controllers: [EscalationsController],
  exports: [EscalationsService],
})
export class EscalationsModule {}
