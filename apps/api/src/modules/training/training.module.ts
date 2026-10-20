import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingAttendance, TrainingCourse, TrainingSession } from './entities/training.entity';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TrainingCourse, TrainingSession, TrainingAttendance, User]), AuthModule],
  providers: [TrainingService],
  controllers: [TrainingController],
  exports: [TrainingService],
})
export class TrainingModule {}