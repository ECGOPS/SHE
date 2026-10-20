import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentalEvent } from './entities/environmental-event.entity';
import { EnvironmentalAttachment } from './entities/environmental-attachment.entity';
import { EnvironmentalService } from './environmental.service';
import { EnvironmentalController } from './environmental.controller';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [TypeOrmModule.forFeature([EnvironmentalEvent, EnvironmentalAttachment, CorrectiveAction]), AuthModule, OrganizationsModule],
  providers: [EnvironmentalService],
  controllers: [EnvironmentalController],
})
export class EnvironmentalModule {}
