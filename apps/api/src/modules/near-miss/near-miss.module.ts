import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NearMiss } from './entities/near-miss.entity';
import { NearMissAttachment } from './entities/near-miss-attachment.entity';
import { NearMissService } from './near-miss.service';
import { NearMissController } from './near-miss.controller';
import { User } from '../users/entities/user.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NearMiss, NearMissAttachment, User, CorrectiveAction, IssueEscalation]),
    AuthModule,
    OrganizationsModule,
    NotificationsModule,
    RealtimeModule,
  ],
  providers: [NearMissService],
  controllers: [NearMissController],
})
export class NearMissModule {}
