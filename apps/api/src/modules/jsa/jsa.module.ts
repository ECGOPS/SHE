import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsaRecord } from './entities/jsa.entity';
import { JsaService } from './jsa.service';
import { JsaController } from './jsa.controller';
import { User } from '../users/entities/user.entity';
import { Permit } from '../ptw/entities/permit.entity';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [TypeOrmModule.forFeature([JsaRecord, User, Permit]), AuthModule, OrganizationsModule],
  providers: [JsaService],
  controllers: [JsaController],
})
export class JsaModule {}
