import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configValidationSchema } from './config/config.schema';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { TenantScopeService } from './common/tenancy/tenant-scope.service';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { UuidParamMiddleware } from './common/middleware/uuid-param.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { FreshAuthGuard } from './modules/auth/guards/fresh-auth.guard';
import { AuditTrailInterceptor } from './common/interceptors/audit-trail.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ScopeGuard } from './modules/auth/guards/scope.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { NearMissModule } from './modules/near-miss/near-miss.module';
import { HazardsModule } from './modules/hazards/hazards.module';
import { JsaModule } from './modules/jsa/jsa.module';
import { PtwModule } from './modules/ptw/ptw.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { AuditsModule } from './modules/audits/audits.module';
import { EnvironmentalModule } from './modules/environmental/environmental.module';
import { HealthModule } from './modules/health/health.module';
import { TrainingModule } from './modules/training/training.module';
import { PpeModule } from './modules/ppe/ppe.module';
import { CorrectiveActionsModule } from './modules/corrective-actions/corrective-actions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditTrailModule } from './modules/audit-trail/audit-trail.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ManagementSystemModule } from './modules/management-system/management-system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: configValidationSchema,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    IncidentsModule,
    NearMissModule,
    HazardsModule,
    JsaModule,
    PtwModule,
    InspectionsModule,
    AuditsModule,
    EnvironmentalModule,
    HealthModule,
    TrainingModule,
    PpeModule,
    CorrectiveActionsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    AuditTrailModule,
    RealtimeModule,
    EscalationsModule,
    PrivacyModule,
    ManagementSystemModule,
  ],
  providers: [
    TenantScopeService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_GUARD, useClass: FreshAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditTrailInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [TenantScopeService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, UuidParamMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
