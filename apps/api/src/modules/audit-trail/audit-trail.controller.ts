import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ecg-she/shared';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { AuditTrailService } from './audit-trail.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('audit-trail')
@ApiBearerAuth()
@Controller('audit-trail')
export class AuditTrailController {
  constructor(private readonly svc: AuditTrailService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_TRAIL_READ)
  list(@Query() query: PaginationQueryDto) {
    return this.svc.list(query);
  }
}
