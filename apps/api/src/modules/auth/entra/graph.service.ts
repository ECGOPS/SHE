import { Injectable, Logger } from '@nestjs/common';
import { EntraService } from './entra.service';

export interface GraphUser {
  id: string; // Entra object id
  userPrincipalName: string;
  mail?: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  employeeId?: string;
  accountEnabled: boolean;
  manager?: { id: string };
  memberOfGroupIds?: string[];
}

/**
 * Thin Microsoft Graph client used by the user-provisioning job.
 *
 * Endpoints consumed:
 *   • GET /v1.0/users          — paginated list of all Entra users
 *   • GET /v1.0/users/{id}/manager
 *   • GET /v1.0/users/{id}/memberOf
 *
 * Uses the app-only token from the EntraService (client credentials flow).
 */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private readonly base = 'https://graph.microsoft.com/v1.0';

  constructor(private readonly entra: EntraService) {}

  async listUsers(filter?: string): Promise<GraphUser[]> {
    if (!this.entra.isEnabled()) return [];
    const token = await this.entra.acquireGraphToken();
    const select =
      'id,userPrincipalName,mail,displayName,givenName,surname,jobTitle,department,employeeId,accountEnabled';
    let url: string | undefined =
      `${this.base}/users?$select=${select}&$top=999${filter ? `&$filter=${encodeURIComponent(filter)}` : ''}`;
    const collected: GraphUser[] = [];

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        this.logger.error(`Graph users request failed: ${res.status} ${res.statusText}`);
        break;
      }
      const body = (await res.json()) as { value: GraphUser[]; '@odata.nextLink'?: string };
      collected.push(...body.value);
      url = body['@odata.nextLink'];
    }
    return collected;
  }

  async getMemberGroups(userId: string): Promise<string[]> {
    if (!this.entra.isEnabled()) return [];
    const token = await this.entra.acquireGraphToken();
    const res = await fetch(
      `${this.base}/users/${userId}/getMemberGroups`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityEnabledOnly: false }),
      },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { value: string[] };
    return body.value ?? [];
  }

  async getManager(userId: string): Promise<string | null> {
    if (!this.entra.isEnabled()) return null;
    const token = await this.entra.acquireGraphToken();
    const res = await fetch(`${this.base}/users/${userId}/manager`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string };
    return body.id ?? null;
  }
}
