import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto, UpdateInspectionItemsDto } from './dto/inspection.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendStoredFile } from '../../common/http/safe-download';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('inspections')
@ApiBearerAuth()
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly svc: InspectionsService) {
  }

  @Get()
  @RequirePermissions(Permission.INSPECTION_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequirePermissions(Permission.INSPECTION_READ)
  async attachmentFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    return sendStoredFile(res, await this.svc.getAttachmentFile(user, id, attachmentId));
  }

  @Get(':id')
  @RequirePermissions(Permission.INSPECTION_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.INSPECTION_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Post()
  @RequirePermissions(Permission.INSPECTION_CONDUCT)
  @Audit('INSPECTION_CONDUCT')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInspectionDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id/items')
  @RequirePermissions(Permission.INSPECTION_CONDUCT)
  @Audit('INSPECTION_UPDATE')
  updateItems(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInspectionItemsDto) {
    return this.svc.updateItems(user, id, dto.items);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.INSPECTION_CONDUCT)
  @Audit('INSPECTION_CLOSE')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.close(user, id);
  }
}
