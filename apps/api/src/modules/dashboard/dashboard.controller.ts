import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { reportsInChosenPlace, type AuthUser } from '@ecg-she/shared';
import { DashboardKpiQueryDto, DashboardTrendsQueryDto } from '../../common/dto/request.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  private assertDashboard(user: AuthUser): void {
    if (reportsInChosenPlace(user.role)) {
      throw new ForbiddenException('The dashboard is for safety officers and Head Office safety');
    }
  }

  @Get('kpis')
  kpis(@CurrentUser() user: AuthUser, @Query() query: DashboardKpiQueryDto) {
    this.assertDashboard(user);
    return this.svc.kpis(user, query.hoursWorked);
  }

  @Get('trends')
  trends(@CurrentUser() user: AuthUser, @Query() query: DashboardTrendsQueryDto) {
    this.assertDashboard(user);
    return this.svc.trends(user, query.days);
  }

  @Get('heatmap')
  heatmap(@CurrentUser() user: AuthUser) {
    this.assertDashboard(user);
    return this.svc.heatmap(user);
  }
}
