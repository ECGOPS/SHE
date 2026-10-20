import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { NearMissService } from './near-miss.service';
import { CreateNearMissDto, ReviewNearMissDto } from './dto/near-miss.dto';
import { AssignInvestigatorDto, CloseNotesDto } from '../../common/dto/request.dto';
import type { AuthUser } from '@ecg-she/shared';
import { sendStoredFile } from '../../common/http/safe-download';
import { sendPdf } from '../../common/pdf/she-report';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('near-miss')
@ApiBearerAuth()
@Controller('near-miss')
export class NearMissController {
  constructor(private readonly svc: NearMissService) {}

  @Get()
  @RequirePermissions(Permission.NEAR_MISS_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.svc.list(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Get(':id/assignees')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  assignees(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.assignees(user, id);
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  async attachmentFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    return sendStoredFile(res, await this.svc.getAttachmentFile(user, id, attachmentId));
  }

  @Post()
  @RequirePermissions(Permission.NEAR_MISS_CREATE)
  @Audit('NEAR_MISS_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNearMissDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id/review')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  @Audit('NEAR_MISS_REVIEW')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewNearMissDto) {
    return this.svc.review(user, id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  @Audit('NEAR_MISS_ASSIGN')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: AssignInvestigatorDto,
  ) {
    return this.svc.assign(user, id, body.investigatorId);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.NEAR_MISS_READ)
  @Audit('NEAR_MISS_CLOSE')
  close(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CloseNotesDto,
  ) {
    return this.svc.close(user, id, body.notes ?? '', body.noFurtherAction === true);
  }
}
