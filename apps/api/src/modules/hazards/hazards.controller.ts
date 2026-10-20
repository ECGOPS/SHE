import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { HazardsService } from './hazards.service';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { ReviewHazardDto } from './dto/review-hazard.dto';
import { IsOptional, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CloseNotesDto } from '../../common/dto/request.dto';

class HazardListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(/^(LOW|MEDIUM|HIGH|EXTREME)(,(LOW|MEDIUM|HIGH|EXTREME)){0,3}$/)
  riskClass?: string;
}
import type { AuthUser } from '@ecg-she/shared';
import { sendStoredFile } from '../../common/http/safe-download';
import { sendPdf } from '../../common/pdf/she-report';

@ApiTags('hazards')
@ApiBearerAuth()
@Controller('hazards')
export class HazardsController {
  constructor(private readonly svc: HazardsService) {}

  @Get()
  @RequirePermissions(Permission.HAZARD_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: HazardListQueryDto) {
    return this.svc.list(user, query);
  }

  @Get('stats')
  @RequirePermissions(Permission.HAZARD_READ)
  stats(@CurrentUser() user: AuthUser) {
    return this.svc.stats(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.HAZARD_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Get(':id/report')
  @RequirePermissions(Permission.HAZARD_READ)
  async report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return sendPdf(res, await this.svc.reportPdf(user, id));
  }

  @Get(':id/assignees')
  @RequirePermissions(Permission.HAZARD_READ)
  assignees(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.assignees(user, id);
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequirePermissions(Permission.HAZARD_READ)
  async attachmentFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    return sendStoredFile(res, await this.svc.getAttachmentFile(user, id, attachmentId));
  }

  @Post()
  @RequirePermissions(Permission.HAZARD_CREATE)
  @Audit('HAZARD_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHazardDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id/review')
  @RequirePermissions(Permission.HAZARD_APPROVE)
  @Audit('HAZARD_REVIEW')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewHazardDto) {
    return this.svc.review(user, id, dto);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.HAZARD_APPROVE)
  @Audit('HAZARD_CLOSE')
  close(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CloseNotesDto,
  ) {
    return this.svc.close(user, id, body.notes ?? '', body.noFurtherAction === true);
  }
}
