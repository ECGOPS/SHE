import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, isDistrictScope, isGlobalScope, isRegionalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { Region } from './entities/region.entity';
import { District } from './entities/district.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Region) private readonly regions: Repository<Region>,
    @InjectRepository(District) private readonly districts: Repository<District>,
  ) {}

  listRegions(user: AuthUser): Promise<Region[]> {
    if (isGlobalScope(user.role) || reportsInChosenPlace(user.role)) {
      return this.regions.find({ where: { active: true }, order: { name: 'ASC' } });
    }
    if (!user.regionId) return Promise.resolve([]);
    return this.regions.find({
      where: { id: user.regionId, active: true },
      order: { name: 'ASC' },
    });
  }

  async getRegion(user: AuthUser, id: string): Promise<Region> {
    if (!isGlobalScope(user.role) && !reportsInChosenPlace(user.role) && user.regionId !== id) {
      throw new NotFoundException(`Region ${id} not found`);
    }

    const region = await this.regions.findOne({ where: { id }, relations: ['districts'] });
    if (!region) throw new NotFoundException(`Region ${id} not found`);

    if (isSafetyOfficer(user.role) && isDistrictScope(user.role)) {
      region.districts = (region.districts ?? []).filter((d) => d.id === user.districtId);
    }
    return region;
  }

  listAllRegions(): Promise<Region[]> {
    return this.regions.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  listDistricts(user: AuthUser, regionId?: string): Promise<District[]> {
    if (isSafetyOfficer(user.role) && isDistrictScope(user.role)) {
      if (!user.districtId) return Promise.resolve([]);
      if (regionId && regionId !== user.regionId) return Promise.resolve([]);
      return this.districts.find({
        where: { id: user.districtId, active: true },
        order: { name: 'ASC' },
      });
    }

    if (isSafetyOfficer(user.role) && isRegionalScope(user.role)) {
      if (!user.regionId) return Promise.resolve([]);
      return this.districts.find({
        where: { regionId: user.regionId, active: true },
        order: { name: 'ASC' },
      });
    }

    return this.districts.find({
      where: regionId ? { regionId, active: true } : { active: true },
      order: { name: 'ASC' },
    });
  }

  async getDistrict(user: AuthUser, id: string): Promise<District> {
    const district = await this.districts.findOne({ where: { id }, relations: ['region'] });
    if (!district) throw new NotFoundException(`District ${id} not found`);
    if (isSafetyOfficer(user.role) && isDistrictScope(user.role) && district.id !== user.districtId) {
      throw new NotFoundException(`District ${id} not found`);
    }
    if (isSafetyOfficer(user.role) && isRegionalScope(user.role) && district.regionId !== user.regionId) {
      throw new NotFoundException(`District ${id} not found`);
    }
    return district;
  }

  createRegion(data: Partial<Region>): Promise<Region> {
    return this.regions.save(this.regions.create(data));
  }

  createDistrict(data: Partial<District>): Promise<District> {
    return this.districts.save(this.districts.create(data));
  }

  updateRegion(id: string, data: Partial<Region>): Promise<Region> {
    return this.regions.save({ id, ...data });
  }

  updateDistrict(id: string, data: Partial<District>): Promise<District> {
    return this.districts.save({ id, ...data });
  }
}
