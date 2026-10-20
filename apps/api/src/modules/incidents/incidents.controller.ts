import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, FindingInputDto, SyncIncidentsDto, WitnessInputDto } from './dto/create-incident.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { DateRangeQueryDto } from '../../common/dto/request.dto';
import { sendStoredFile } from '../../common/http/safe-download';
import { sendPdf } from '../../common/pdf/she-report';
import type { AuthUser } from '@ecg-she/shared';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly svc: IncidentsService) {}

  @Get()
  @RequirePermissions(Permission.INCIDENT_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: IncidentQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('stats')
  @RequirePermissions(Permission.INCIDENT_READ)
  stats(@CurrentUser() user: AuthUser, @Query() query: DateRangeQueryDto) {
    return this.svc.stats(user, query.from ? new Date(query.from) : undefined, query.to ? new Date(query.to) : undefined);
  }

  @Get(':id')
  @RequirePermissions(Permission.INCIDENT_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.INCIDENT_READ)
  async report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequirePermissions(Permission.INCIDENT_READ)
  async attachmentFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    return sendStoredFile(res, await this.svc.getAttachmentFile(user, id, attachmentId));
  }

  @Post()
  @RequirePermissions(Permission.INCIDENT_CREATE)
  @Audit('INCIDENT_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIncidentDto) {
    return this.svc.create(user, dto);
  }

  @Post('sync')
  @RequirePermissions(Permission.INCIDENT_CREATE)
  @Audit('INCIDENT_BULK_SYNC')
  sync(@CurrentUser() user: AuthUser, @Body() body: SyncIncidentsDto) {
    return this.svc.bulkSync(user, body.items);
  }

  @Get(':id/assignees')
  @RequirePermissions(Permission.INCIDENT_READ)
  assignees(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.assignees(user, id);
  }

  @Post(':id/witnesses')
  @RequirePermissions(Permission.INCIDENT_READ)
  @Audit('INCIDENT_WITNESS')
  addWitness(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: WitnessInputDto,
  ) {
    return this.svc.addWitness(user, id, dto);
  }

  @Post(':id/findings')
  @RequirePermissions(Permission.INCIDENT_READ)
  @Audit('INCIDENT_FINDING')
  addFinding(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FindingInputDto,
  ) {
    return this.svc.addFinding(user, id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.INCIDENT_READ)
  @Audit('INCIDENT_ASSIGN')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('investigatorId') investigatorId: string,
  ) {
    return this.svc.assignInvestigator(user, id, investigatorId);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.INCIDENT_INVESTIGATE)
  @Audit('INCIDENT_SUBMIT')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.submitForApproval(user, id);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.INCIDENT_APPROVE)
  @Audit('INCIDENT_CLOSE')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.closeIncident(user, id);
  }
}
