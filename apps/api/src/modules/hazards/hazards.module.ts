import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hazard } from './entities/hazard.entity';
import { HazardAttachment } from './entities/hazard-attachment.entity';
import { User } from '../users/entities/user.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';
import { HazardsService } from './hazards.service';
import { HazardsController } from './hazards.controller';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hazard, HazardAttachment, User, CorrectiveAction, IssueEscalation]),
    AuthModule,
    OrganizationsModule,
    RealtimeModule,
    NotificationsModule,
  ],
  providers: [HazardsService],
  controllers: [HazardsController],
  exports: [HazardsService],
})
export class HazardsModule {}
