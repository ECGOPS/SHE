import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditRecord } from './entities/audit-record.entity';
import { AuditFinding } from './entities/audit-finding.entity';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';
import { User } from '../users/entities/user.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditRecord, AuditFinding, User, CorrectiveAction]), AuthModule, OrganizationsModule],
  providers: [AuditsService],
  controllers: [AuditsController],
})
export class AuditsModule {}
