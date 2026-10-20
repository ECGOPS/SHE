import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, type AuthUser } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ManagementSystemService } from './management-system.service';
import { CreateManagementRecordDto, ManagementQueryDto, UpdateManagementRecordDto } from './dto/management-record.dto';

@ApiTags('management-system')
@ApiBearerAuth()
@Controller('management-system')
export class ManagementSystemController {
  constructor(private readonly svc: ManagementSystemService) {}

  @Get('summary')
  @RequirePermissions(Permission.IMS_READ)
  summary(@CurrentUser() user: AuthUser) {
    return this.svc.summary(user);
  }

  @Get()
  @RequirePermissions(Permission.IMS_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: ManagementQueryDto) {
    return this.svc.list(user, query);
  }

  @Post()
  @RequirePermissions(Permission.IMS_READ)
  @Audit('IMS_CREATE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateManagementRecordDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.IMS_MANAGE)
  @Audit('IMS_UPDATE')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManagementRecordDto,
  ) {
    return this.svc.update(user, id, dto);
  }
}
