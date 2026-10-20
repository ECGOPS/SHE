import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CorrectiveActionsService } from './corrective-actions.service';
import { CreateCapaDto, UpdateCapaProgressDto, VerifyCapaDto } from './dto/create-capa.dto';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendPdf } from '../../common/pdf/she-report';

class CapaListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['INCIDENT', 'HAZARD', 'NEAR_MISS', 'INSPECTION', 'AUDIT_FINDING', 'ENVIRONMENTAL_EVENT', 'CUSTOMER_COMPLAINT', 'INTERNAL_REVIEW'])
  sourceType?: string;
  @IsOptional() @IsUUID() sourceId?: string;
}

@ApiTags('corrective-actions')
@ApiBearerAuth()
@Controller('corrective-actions')
export class CorrectiveActionsController {
  constructor(private readonly svc: CorrectiveActionsService) {}

  @Get()
  @RequirePermissions(Permission.CAPA_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: CapaListQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('stats')
  @RequirePermissions(Permission.CAPA_READ)
  stats(@CurrentUser() user: AuthUser) {
    return this.svc.stats(user);
  }

  @Get('people')
  @RequirePermissions(Permission.CAPA_CREATE)
  people(@CurrentUser() user: AuthUser) {
    return this.svc.people(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.CAPA_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.CAPA_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.CAPA_CREATE)
  @Audit('CAPA_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCapaDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id/progress')
  @RequirePermissions(Permission.CAPA_UPDATE)
  @Audit('CAPA_PROGRESS')
  progress(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCapaProgressDto) {
    return this.svc.progress(user, id, dto);
  }

  @Post(':id/verify')
  @RequirePermissions(Permission.CAPA_VERIFY)
  @Audit('CAPA_VERIFY')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: VerifyCapaDto) {
    return this.svc.verify(user, id, dto);
  }
}
