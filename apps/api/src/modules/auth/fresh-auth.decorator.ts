import { SetMetadata } from '@nestjs/common';

export const FRESH_AUTH_KEY = 'freshAuth';

/** The caller must have signed in, or confirmed their password, in the fresh-auth window. */
export const RequireFreshAuth = () => SetMetadata(FRESH_AUTH_KEY, true);
