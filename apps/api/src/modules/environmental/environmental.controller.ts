import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { EnvironmentalService } from './environmental.service';
import {
  AddEnvironmentalPhotosDto,
  AssessEnvironmentalEventDto,
  CloseEnvironmentalEventDto,
  ContainEnvironmentalEventDto,
  CreateEnvironmentalEventDto,
  WasteConsignmentDto,
} from './dto/environmental.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendStoredFile } from '../../common/http/safe-download';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('environmental')
@ApiBearerAuth()
@Controller('environmental')
export class EnvironmentalController {
  constructor(private readonly svc: EnvironmentalService) {
  }

  @Get()
  @RequirePermissions(Permission.ENV_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequirePermissions(Permission.ENV_READ)
  async attachmentFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    return sendStoredFile(res, await this.svc.getAttachmentFile(user, id, attachmentId));
  }

  @Get(':id')
  @RequirePermissions(Permission.ENV_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.ENV_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.ENV_CREATE)
  @Audit('ENV_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEnvironmentalEventDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id/containment')
  @RequirePermissions(Permission.ENV_CREATE)
  @Audit('ENV_CONTAIN')
  contain(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ContainEnvironmentalEventDto) {
    return this.svc.contain(user, id, dto);
  }

  @Patch(':id/assess')
  @RequirePermissions(Permission.ENV_CLOSE)
  @Audit('ENV_ASSESS')
  assess(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssessEnvironmentalEventDto) {
    return this.svc.assess(user, id, dto);
  }

  @Patch(':id/waste')
  @RequirePermissions(Permission.ENV_CREATE)
  @Audit('ENV_WASTE')
  waste(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: WasteConsignmentDto) {
    return this.svc.recordWaste(user, id, dto);
  }

  @Post(':id/photos')
  @RequirePermissions(Permission.ENV_CREATE)
  @Audit('ENV_PHOTO')
  photos(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddEnvironmentalPhotosDto) {
    return this.svc.addPhotos(user, id, dto);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.ENV_CLOSE)
  @Audit('ENV_CLOSE')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CloseEnvironmentalEventDto) {
    return this.svc.close(user, id, dto);
  }

  @Post(':id/reopen')
  @RequirePermissions(Permission.ENV_CLOSE)
  @Audit('ENV_REOPEN')
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.reopen(user, id);
  }
}
