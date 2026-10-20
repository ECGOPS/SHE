import { SetMetadata } from '@nestjs/common';

/** Routes a short-lived MFA enrollment token is allowed to call. */
export const ALLOW_MFA_SETUP_KEY = 'allowMfaSetup';
export const AllowDuringMfaSetup = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_MFA_SETUP_KEY, true);
