import { Injectable } from '@nestjs/common';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { getCurrentTenantId, getCurrentUserId } from '../common/context/request-context';

/**
 * Auto-populates the standard audit columns required by the enterprise spec
 * (`createdBy`, `updatedBy`, `deletedBy`) and the `tenantId` column on every
 * write. Reads the current user / tenant from the AsyncLocalStorage
 * `RequestContext` set by `RequestContextMiddleware`.
 *
 * Behaviour:
 *  • Insert      → `createdBy = updatedBy = currentUserId`, `tenantId` set if missing
 *  • Update      → `updatedBy = currentUserId`
 *  • Soft-remove → `deletedBy = currentUserId`
 *
 * Hard-deletes are intentionally not supported in the application — services
 * always call `.softRemove()` so the audit trail is preserved.
 */
@Injectable()
@EventSubscriber()
export class AuditColumnsSubscriber implements EntitySubscriberInterface<BaseEntity> {
  listenTo(): typeof BaseEntity {
    return BaseEntity;
  }

  beforeInsert(event: InsertEvent<BaseEntity>): void {
    if (!event.entity) return;
    const userId = getCurrentUserId();
    const tenantId = getCurrentTenantId();
    const hideReporter =
      event.metadata.tableName === 'near_misses' &&
      (event.entity as { anonymous?: boolean }).anonymous === true;
    if (hideReporter) {
      event.entity.createdBy = null;
      event.entity.updatedBy = null;
    } else if (userId) {
      event.entity.createdBy ??= userId;
      event.entity.updatedBy ??= userId;
    }
    if (tenantId && !event.entity.tenantId) {
      event.entity.tenantId = tenantId;
    }
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): void {
    if (!event.entity) return;
    const userId = getCurrentUserId();
    if (userId) (event.entity as BaseEntity).updatedBy = userId;
  }

  beforeSoftRemove(event: SoftRemoveEvent<BaseEntity>): void {
    if (!event.entity) return;
    const userId = getCurrentUserId();
    if (userId) (event.entity as BaseEntity).deletedBy = userId;
  }
}
