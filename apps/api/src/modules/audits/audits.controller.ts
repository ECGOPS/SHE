import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AuditsService } from './audits.service';
import { AuditNoteDto, CreateAuditDto, LinkFindingActionDto, UpdateChecklistDto } from './dto/audit.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('audits')
@ApiBearerAuth()
@Controller('audits')
export class AuditsController {
  constructor(private readonly svc: AuditsService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('people')
  @RequirePermissions(Permission.AUDIT_READ)
  people(@CurrentUser() user: AuthUser) {
    return this.svc.people(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.AUDIT_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.AUDIT_READ)
  async downloadReport(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.AUDIT_CONDUCT)
  @Audit('AUDIT_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAuditDto) {
    return this.svc.create(user, dto);
  }

  @Post(':id/start')
  @RequirePermissions(Permission.AUDIT_CONDUCT)
  @Audit('AUDIT_START')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.start(user, id);
  }

  @Patch(':id/checklist')
  @RequirePermissions(Permission.AUDIT_CONDUCT)
  @Audit('AUDIT_CHECKLIST')
  checklist(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateChecklistDto) {
    return this.svc.saveChecklist(user, id, dto.checklist);
  }

  @Post(':id/report')
  @RequirePermissions(Permission.AUDIT_CONDUCT)
  @Audit('AUDIT_REPORT')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.report(user, id);
  }

  @Post(':id/findings/:findingId/response')
  @RequirePermissions(Permission.AUDIT_READ)
  @Audit('AUDIT_FINDING_RESPONSE')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('findingId') findingId: string,
    @Body() dto: AuditNoteDto,
  ) {
    return this.svc.respond(user, id, findingId, dto.notes);
  }

  @Post(':id/findings/:findingId/action')
  @RequirePermissions(Permission.AUDIT_READ)
  @Audit('AUDIT_FINDING_ACTION')
  linkAction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('findingId') findingId: string,
    @Body() dto: LinkFindingActionDto,
  ) {
    return this.svc.linkAction(user, id, findingId, dto.capaId);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.AUDIT_CLOSE)
  @Audit('AUDIT_CLOSE')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.close(user, id);
  }
}
