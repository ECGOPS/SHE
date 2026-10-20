import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { HealthRecord } from '../health/entities/health-record.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { SessionModule } from '../auth/session.module';
import { AuthModule } from '../auth/auth.module';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, HealthRecord, Incident]), SessionModule, AuthModule],
  providers: [PrivacyService],
  controllers: [PrivacyController],
})
export class PrivacyModule {}
