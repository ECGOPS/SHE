import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit:action';
export const Audit = (action: string): MethodDecorator => SetMetadata(AUDIT_ACTION_KEY, action);
