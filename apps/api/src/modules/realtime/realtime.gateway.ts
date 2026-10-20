import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { isDistrictScope, isGlobalScope, isRegionalScope, Role } from '@ecg-she/shared';
import { allowsBrowserOrigin } from '../../config/dev-origin';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

interface AuthSocket extends Socket {
  data: {
    userId?: string;
    role?: Role;
    regionId?: string | null;
    districtId?: string | null;
  };
}

/**
 * Each connected client joins only the rooms its role is allowed to hear:
 *
 *   - SYS_ADMIN / GLOBAL_USER → global
 *   - REGIONAL_USER           → region:<id>
 *   - DISTRICT_USER           → district:<id>
 *
 * `emitToScope` publishes to global, the region room, and the district room.
 * Clients outside that scope are not members of those rooms.
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => {
      callback(null, allowsBrowserOrigin(origin));
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async handleConnection(client: AuthSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization?.toString().replace(/^Bearer\s+/i, '') as string | undefined);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role: Role;
        regionId: string | null;
        districtId: string | null;
      }>(token, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });

      client.data = {
        userId: payload.sub,
        role: payload.role,
        regionId: payload.regionId,
        districtId: payload.districtId,
      };

      if (isGlobalScope(payload.role)) {
        client.join('global');
      } else if (isRegionalScope(payload.role) && payload.regionId) {
        client.join(`region:${payload.regionId}`);
      } else if (isDistrictScope(payload.role) && payload.districtId) {
        client.join(`district:${payload.districtId}`);
      }
      client.join(`user:${payload.sub}`);
    } catch (err) {
      this.logger.warn(`Realtime auth failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: AuthSocket): void {
    // socket-io cleans rooms automatically
  }

  emitToScope(regionId: string, districtId: string | undefined, event: string, payload: unknown): void {
    this.server.to('global').emit(event, payload);
    this.server.to(`region:${regionId}`).emit(event, payload);
    if (districtId) this.server.to(`district:${districtId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
