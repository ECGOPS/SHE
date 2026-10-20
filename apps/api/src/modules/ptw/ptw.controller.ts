import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { PtwService } from './ptw.service';
import { CreatePermitDto, GasTestDto, PermitNoteDto } from './dto/permit.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('ptw')
@ApiBearerAuth()
@Controller('ptw')
export class PtwController {
  constructor(private readonly svc: PtwService) {}

  @Get()
  @RequirePermissions(Permission.PTW_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('people')
  @RequirePermissions(Permission.PTW_READ)
  people(@CurrentUser() user: AuthUser) {
    return this.svc.people(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.PTW_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.PTW_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.PTW_CREATE)
  @Audit('PTW_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePermitDto) {
    return this.svc.create(user, dto);
  }

  @Post(':id/gas-test')
  @RequirePermissions(Permission.PTW_CREATE)
  @Audit('PTW_GAS_TEST')
  gasTest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: GasTestDto) {
    return this.svc.recordGasTest(user, id, dto);
  }

  @Post(':id/issue')
  @RequirePermissions(Permission.PTW_APPROVE)
  @Audit('PTW_ISSUE')
  issue(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.issue(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.PTW_APPROVE)
  @Audit('PTW_APPROVE')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.issue(user, id);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.PTW_APPROVE)
  @Audit('PTW_REJECT')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: PermitNoteDto) {
    return this.svc.reject(user, id, body.notes ?? '');
  }

  @Post(':id/revise')
  @RequirePermissions(Permission.PTW_CREATE)
  @Audit('PTW_REVISE')
  revise(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.revise(user, id);
  }

  @Post(':id/accept')
  @RequirePermissions(Permission.PTW_READ)
  @Audit('PTW_ACCEPT')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.accept(user, id);
  }

  @Post(':id/suspend')
  @RequirePermissions(Permission.PTW_READ)
  @Audit('PTW_SUSPEND')
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: PermitNoteDto) {
    return this.svc.suspend(user, id, body.notes ?? '');
  }

  @Post(':id/resume')
  @RequirePermissions(Permission.PTW_READ)
  @Audit('PTW_RESUME')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.resume(user, id);
  }

  @Post(':id/handback')
  @RequirePermissions(Permission.PTW_READ)
  @Audit('PTW_HANDBACK')
  handback(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: PermitNoteDto) {
    return this.svc.handback(user, id, body.notes ?? '');
  }

  @Post(':id/close')
  @RequirePermissions(Permission.PTW_APPROVE)
  @Audit('PTW_CLOSE')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.close(user, id);
  }
}
