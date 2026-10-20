import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Permission } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import type { AuthUser } from '@ecg-she/shared';
import { DateRangeQueryDto } from '../../common/dto/request.dto';
import { applyDownloadHeaders } from '../../common/http/safe-download';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('register/excel')
  @RequirePermissions(Permission.REPORT_GENERATE)
  async registerExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query() query: DateRangeQueryDto,
  ) {
    const buffer = await this.svc.registerExcel(user, query.from ? new Date(query.from) : undefined, query.to ? new Date(query.to) : undefined);
    applyDownloadHeaders(
      res,
      'attachment',
      'she-activity-register.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.end(buffer);
  }

  @Get('register/pdf')
  @RequirePermissions(Permission.REPORT_GENERATE)
  async summaryPdf(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query() query: DateRangeQueryDto,
  ) {
    const buffer = await this.svc.summaryPdf(user, query.from ? new Date(query.from) : undefined, query.to ? new Date(query.to) : undefined);
    applyDownloadHeaders(res, 'attachment', 'she-activity-summary.pdf', 'application/pdf');
    res.end(buffer);
  }
}
