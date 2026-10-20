import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, Permission, Role } from '@ecg-she/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, RequirePermissions } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { OrganizationsService } from './organizations.service';
import { OrganizationsAdminService } from './organizations-admin.service';
import { CreateDistrictDto, CreateRegionDto, PruneOrphansDto, UpdateDistrictDto, UpdateRegionDto } from './dto/create-region.dto';
import { RegionFilterQueryDto } from '../../common/dto/request.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly svc: OrganizationsService,
    private readonly admin: OrganizationsAdminService,
  ) {}

  @Get('regions')
  listRegions(@CurrentUser() user: AuthUser) {
    return this.svc.listRegions(user);
  }

  @Get('regions/:id')
  getRegion(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.getRegion(user, id);
  }

  @Post('regions')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.ORG_MANAGE)
  @Audit('ORG_CREATE_REGION')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.svc.createRegion(dto);
  }

  @Patch('regions/:id')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.ORG_MANAGE)
  @Audit('ORG_UPDATE_REGION')
  updateRegion(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.svc.updateRegion(id, dto);
  }

  @Get('districts')
  listDistricts(@CurrentUser() user: AuthUser, @Query() query: RegionFilterQueryDto) {
    return this.svc.listDistricts(user, query.regionId);
  }

  @Get('districts/:id')
  getDistrict(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.getDistrict(user, id);
  }

  @Post('districts')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.ORG_MANAGE)
  @Audit('ORG_CREATE_DISTRICT')
  createDistrict(@Body() dto: CreateDistrictDto) {
    return this.svc.createDistrict(dto);
  }

  @Patch('districts/:id')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.ORG_MANAGE)
  @Audit('ORG_UPDATE_DISTRICT')
  updateDistrict(@Param('id') id: string, @Body() dto: UpdateDistrictDto) {
    return this.svc.updateDistrict(id, dto);
  }

  /**
   * List regions whose code is no longer present in the canonical seed list
   * (e.g. left over after an `AS` → `ASE` rename). Each entry includes a
   * dependency breakdown so the admin can see what references the region
   * before deciding to prune it.
   */
  @Get('legacy/orphans')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.ORG_MANAGE)
  @ApiOperation({ summary: 'List orphan regions (legacy codes not in current seed)' })
  listOrphans() {
    return this.admin.listOrphans();
  }

  /**
   * Hard-delete the orphan region(s) identified by `codes`. Refuses to
   * delete a region that has any users or scoped domain records (incidents,
   * hazards, audits, …) referencing it. Pass `force=true` to also delete
   * the region's empty districts in the same transaction.
   */
  @Post('legacy/prune')
  @Roles(Role.SYS_ADMIN)
  @RequirePermissions(Permission.ORG_MANAGE)
  @Audit('ORG_PRUNE_LEGACY')
  @ApiOperation({ summary: 'Prune orphan regions that have no dependent records' })
  pruneOrphans(@Body() body: PruneOrphansDto) {
    return this.admin.pruneOrphans(body.codes, !!body.force);
  }
}
