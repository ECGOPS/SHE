import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { sendPdf } from '../../common/pdf/she-report';
import { RiskAssessmentsService } from './risk-assessments.service';
import {
  CreateRiskAssessmentDto,
  RejectRiskAssessmentDto,
  UpdateRiskAssessmentDto,
} from './dto/risk-assessment.dto';

@ApiTags('risk-assessments')
@ApiBearerAuth()
@Controller('risk-assessments')
export class RiskAssessmentsController {
  constructor(private readonly svc: RiskAssessmentsService) {}

  @Get()
  @RequirePermissions(Permission.RISK_ASSESSMENT_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.RISK_ASSESSMENT_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.RISK_ASSESSMENT_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.RISK_ASSESSMENT_CREATE)
  @Audit('RISK_ASSESSMENT_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRiskAssessmentDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.RISK_ASSESSMENT_CREATE)
  @Audit('RISK_ASSESSMENT_UPDATE')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRiskAssessmentDto) {
    return this.svc.update(user, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.RISK_ASSESSMENT_CREATE)
  @Audit('RISK_ASSESSMENT_SUBMIT')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.submit(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.RISK_ASSESSMENT_APPROVE)
  @Audit('RISK_ASSESSMENT_APPROVE')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.approve(user, id);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.RISK_ASSESSMENT_APPROVE)
  @Audit('RISK_ASSESSMENT_REJECT')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: RejectRiskAssessmentDto) {
    return this.svc.reject(user, id, body.notes ?? '');
  }

  @Post(':id/revise')
  @RequirePermissions(Permission.RISK_ASSESSMENT_CREATE)
  @Audit('RISK_ASSESSMENT_REVISE')
  revise(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.revise(user, id);
  }
}
