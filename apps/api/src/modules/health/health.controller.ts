import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { HealthService } from './health.service';
import { CreateHealthRecordDto } from './dto/health.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('health')
@ApiBearerAuth()
@Controller('health')
export class HealthController {
  constructor(private readonly svc: HealthService) {}

  @Get()
  @RequirePermissions(Permission.HEALTH_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('people')
  @RequirePermissions(Permission.HEALTH_CREATE)
  people(@CurrentUser() user: AuthUser) {
    return this.svc.people(user);
  }

  @Get(':id')
  @Audit('HEALTH_READ')
  @RequirePermissions(Permission.HEALTH_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @Audit('HEALTH_READ')
  @RequirePermissions(Permission.HEALTH_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.HEALTH_CREATE)
  @Audit('HEALTH_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHealthRecordDto) {
    return this.svc.create(user, dto);
  }
}
