import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PpeItem, PpeIssuance } from './entities/ppe.entity';
import { PpeService } from './ppe.service';
import { PpeController } from './ppe.controller';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([PpeItem, PpeIssuance, User]), AuthModule, NotificationsModule],
  providers: [PpeService],
  controllers: [PpeController],
  exports: [PpeService],
})
export class PpeModule {}
