import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Incident } from '../incidents/entities/incident.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { EnvironmentalEvent } from '../environmental/entities/environmental-event.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, Hazard, NearMiss, CorrectiveAction, EnvironmentalEvent]),
    AuthModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
