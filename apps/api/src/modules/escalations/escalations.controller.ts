import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { EscalationHistoryQueryDto } from '../../common/dto/request.dto';
import { EscalationsService } from './escalations.service';
import { EscalateBodyDto, ReopenBodyDto, ResolveBodyDto } from './dto/escalation.dto';

@ApiTags('escalations')
@ApiBearerAuth()
@Controller('escalations')
export class EscalationsController {
  constructor(private readonly svc: EscalationsService) {}

  @Get()
  @ApiOperation({ summary: 'Full transition history for a single issue' })
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: EscalationHistoryQueryDto,
  ) {
    return this.svc.history(user, query.entityType, query.entityId);
  }

  @Post('escalate')
  @Audit('ISSUE_ESCALATED')
  @ApiOperation({ summary: 'Send the issue up to a higher tier (district → regional → HQ)' })
  escalate(@CurrentUser() user: AuthUser, @Body() body: EscalateBodyDto) {
    return this.svc.escalate(user, body);
  }

  @Post('refer-down')
  @Audit('ISSUE_REFERRED_DOWN')
  @ApiOperation({ summary: 'Send the issue back down the ladder for further investigation' })
  referDown(@CurrentUser() user: AuthUser, @Body() body: EscalateBodyDto) {
    return this.svc.referDown(user, body);
  }

  @Post('resolve')
  @Audit('ISSUE_RESOLVED')
  @ApiOperation({ summary: 'Close the issue at the current tier' })
  resolve(@CurrentUser() user: AuthUser, @Body() body: ResolveBodyDto) {
    return this.svc.resolve(user, body);
  }

  @Post('reopen')
  @Audit('ISSUE_REOPENED')
  @ApiOperation({ summary: 'Reverse a previous resolution' })
  reopen(@CurrentUser() user: AuthUser, @Body() body: ReopenBodyDto) {
    return this.svc.reopen(user, body);
  }
}
