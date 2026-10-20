import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { JsaService } from './jsa.service';
import { CreateJsaDto, RejectJsaDto, UpdateJsaDto } from './dto/jsa.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('jsa')
@ApiBearerAuth()
@Controller('jsa')
export class JsaController {
  constructor(private readonly svc: JsaService) {}

  @Get()
  @RequirePermissions(Permission.JSA_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('people')
  @RequirePermissions(Permission.JSA_READ)
  people(@CurrentUser() user: AuthUser) {
    return this.svc.people(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.JSA_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.JSA_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.JSA_CREATE)
  @Audit('JSA_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJsaDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.JSA_CREATE)
  @Audit('JSA_UPDATE')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateJsaDto) {
    return this.svc.update(user, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.JSA_CREATE)
  @Audit('JSA_SUBMIT')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.submit(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.JSA_APPROVE)
  @Audit('JSA_APPROVE')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.approve(user, id);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.JSA_APPROVE)
  @Audit('JSA_REJECT')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: RejectJsaDto) {
    return this.svc.reject(user, id, body.notes ?? '');
  }

  @Post(':id/revise')
  @RequirePermissions(Permission.JSA_CREATE)
  @Audit('JSA_REVISE')
  revise(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.revise(user, id);
  }
}
