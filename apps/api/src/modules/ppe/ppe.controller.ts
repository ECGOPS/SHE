import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, type AuthUser } from '@ecg-she/shared';
import { PpeService } from './ppe.service';
import { CreatePpeItemDto, IssuePpeDto, WithdrawPpeDto } from './dto/ppe.dto';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { HolderKitQueryDto } from '../../common/dto/request.dto';

class PpeListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  stockLow?: boolean;
}

@ApiTags('ppe')
@ApiBearerAuth()
@Controller('ppe')
export class PpeController {
  constructor(private readonly ppe: PpeService) {}

  @Get('items')
  @RequirePermissions(Permission.PPE_READ)
  items(@CurrentUser() user: AuthUser, @Query() query: PpeListQueryDto) {
    return this.ppe.listItems(user, query);
  }

  @Post('items')
  @RequirePermissions(Permission.PPE_MANAGE)
  createItem(@CurrentUser() user: AuthUser, @Body() dto: CreatePpeItemDto) {
    return this.ppe.createItem(user, dto);
  }

  @Get('items/:id')
  @RequirePermissions(Permission.PPE_READ)
  item(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ppe.getItem(user, id);
  }

  @Get('due')
  @RequirePermissions(Permission.PPE_READ)
  due(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.ppe.due(user, query);
  }

  @Get('people')
  @RequirePermissions(Permission.PPE_MANAGE)
  people(@CurrentUser() user: AuthUser) {
    return this.ppe.people(user);
  }

  @Get('holder/:employeeId')
  @RequirePermissions(Permission.PPE_READ)
  holder(
    @Param('employeeId') employeeId: string,
    @Query() query: HolderKitQueryDto,
  ) {
    return this.ppe.holderKit(employeeId, query.category);
  }

  @Post('issuance')
  @RequirePermissions(Permission.PPE_MANAGE)
  issue(@CurrentUser() user: AuthUser, @Body() dto: IssuePpeDto) {
    return this.ppe.issue(user, dto);
  }

  @Post('issuance/:id/withdraw')
  @RequirePermissions(Permission.PPE_MANAGE)
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: WithdrawPpeDto) {
    return this.ppe.withdraw(user, id, dto);
  }
}
