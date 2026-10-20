import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role, AuthUser, isDistrictScope, isRegionalScope } from '@ecg-she/shared';
import { Roles, RequirePermissions } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { UsersService } from './users.service';
import { AssignUserDto, CreateUserDto, SetActiveDto } from './dto/create-user.dto';
import { UserListQueryDto } from '../../common/dto/request.dto';
import { RequireFreshAuth } from '../auth/fresh-auth.decorator';
import { SessionService } from '../auth/session.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get()
  @RequirePermissions(Permission.USER_MANAGE)
  list(@CurrentUser() user: AuthUser, @Query() query: UserListQueryDto) {
    if (isRegionalScope(user.role) && user.regionId) query.regionId = user.regionId;
    if (isDistrictScope(user.role) && user.districtId) query.districtId = user.districtId;
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.USER_MANAGE)
  get(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.getForActor(actor, id);
  }

  @Post()
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.USER_MANAGE)
  @Audit('USER_CREATE')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id/assignment')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.USER_MANAGE)
  @RequireFreshAuth()
  @Audit('USER_ASSIGN')
  async assign(@Param('id') id: string, @Body() dto: AssignUserDto) {
    const user = await this.users.assign(id, dto);
    await this.sessions.revokeAll(id);
    return user;
  }

  @Patch(':id/active')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.USER_MANAGE)
  @RequireFreshAuth()
  @Audit('USER_ACTIVE')
  async setActive(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: SetActiveDto) {
    if (id === actor.id && !dto.active) {
      throw new BadRequestException('You cannot disable your own account');
    }
    const user = await this.users.setActive(id, dto.active);
    if (!dto.active) await this.sessions.revokeAll(id);
    return user;
  }
}
