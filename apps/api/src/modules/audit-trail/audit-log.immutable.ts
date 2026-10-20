import { ForbiddenException } from '@nestjs/common';
import { EntitySubscriberInterface, EventSubscriber, RemoveEvent, UpdateEvent } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export function rejectAuditMutation(): never {
  throw new ForbiddenException('Audit records cannot be changed or removed');
}

/** The hash chain is append-only. An update or delete is refused. */
@EventSubscriber()
export class AuditLogImmutableSubscriber implements EntitySubscriberInterface<AuditLog> {
  listenTo(): typeof AuditLog {
    return AuditLog;
  }

  beforeUpdate(_event: UpdateEvent<AuditLog>): void {
    rejectAuditMutation();
  }

  beforeRemove(_event: RemoveEvent<AuditLog>): void {
    rejectAuditMutation();
  }
}
