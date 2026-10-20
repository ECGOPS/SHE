import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { TrainingService } from './training.service';
import { CreateCourseDto, RecordClassDto } from './dto/training.dto';
import type { AuthUser } from '@ecg-she/shared';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CompetenceQueryDto } from '../../common/dto/request.dto';
import { sendStoredFile } from '../../common/http/safe-download';

@ApiTags('training')
@ApiBearerAuth()
@Controller('training')
export class TrainingController {
  constructor(private readonly svc: TrainingService) {}

  @Get('courses')
  @RequirePermissions(Permission.TRAINING_READ)
  listCourses(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.listCourses(user, query);
  }

  @Post('courses')
  @RequirePermissions(Permission.TRAINING_MANAGE)
  @Audit('TRAINING_COURSE_CREATE')
  createCourse(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto) {
    return this.svc.createCourse(user, dto);
  }

  @Get('courses/:id')
  @RequirePermissions(Permission.TRAINING_READ)
  getCourse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.getCourse(user, id);
  }

  @Get('due')
  @RequirePermissions(Permission.TRAINING_READ)
  due(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.due(user, query);
  }

  @Get('people')
  @RequirePermissions(Permission.TRAINING_MANAGE)
  people(@CurrentUser() user: AuthUser) {
    return this.svc.people(user);
  }

  @Get('competence/:employeeId')
  @RequirePermissions(Permission.TRAINING_READ)
  competence(@Param('employeeId') employeeId: string, @Query() query: CompetenceQueryDto) {
    return this.svc.competence(employeeId, query.duty);
  }

  @Post('classes')
  @RequirePermissions(Permission.TRAINING_MANAGE)
  @Audit('TRAINING_CLASS_RECORD')
  recordClass(@CurrentUser() user: AuthUser, @Body() dto: RecordClassDto) {
    return this.svc.recordClass(user, dto);
  }

  @Get('certificates/:attendanceId/file')
  @RequirePermissions(Permission.TRAINING_READ)
  async certificate(
    @CurrentUser() user: AuthUser,
    @Param('attendanceId') attendanceId: string,
    @Res() res: Response,
  ) {
    return sendStoredFile(res, await this.svc.certificateFile(user, attendanceId));
  }
}
