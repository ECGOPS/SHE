import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import * as webPush from 'web-push';
import { HEAD_OFFICE_OFFICER_ROLES, NotificationChannel, Role } from '@ecg-she/shared';
import { Notification, PushSubscriptionRecord } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SERVICE_TLS } from '../../common/crypto/tls';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface BroadcastInput {
  /** Domain-event topic, e.g. `incident.created`. */
  topic: string;
  /** Short title — shown as the menu line. */
  title: string;
  /** Body — shown in the menu and on push/email. */
  body: string;
  /** Region the event happened in. */
  regionId: string;
  /** District (optional, narrows fan-out). */
  districtId?: string | null;
  /** Arbitrary structured data, also forwarded over WS for deep-linking. */
  payload?: Record<string, unknown>;
  /** Defaults to NORMAL; CRITICAL bypasses email throttling rules. */
  priority?: NotificationPriority;
  /** Skip the user that triggered the event so they don't notify themselves. */
  excludeUserId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private mailer?: nodemailer.Transporter;
  private vapidConfigured = false;

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(PushSubscriptionRecord) private readonly subs: Repository<PushSubscriptionRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly realtime: RealtimeGateway,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const port = this.config.get<number>('SMTP_PORT', 587);
      const tls = this.config.get<boolean>('SMTP_TLS', true);
      this.mailer = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: tls,
        tls: tls ? { minVersion: SERVICE_TLS.minVersion, rejectUnauthorized: true } : undefined,
        auth:
          this.config.get<string>('SMTP_USER') && this.config.get<string>('SMTP_PASS')
            ? { user: this.config.get<string>('SMTP_USER')!, pass: this.config.get<string>('SMTP_PASS')! }
            : undefined,
      });
    }

    const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (pub && priv) {
      webPush.setVapidDetails(this.config.get<string>('VAPID_SUBJECT', 'mailto:she@ecg.com.gh'), pub, priv);
      this.vapidConfigured = true;
    }
  }

  async send(input: {
    recipientId: string;
    channel: NotificationChannel;
    topic: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    email?: string;
    phone?: string;
  }): Promise<Notification> {
    const record = await this.repo.save(
      this.repo.create({
        recipientId: input.recipientId,
        channel: input.channel,
        topic: input.topic,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
      }),
    );

    try {
      if (input.channel === NotificationChannel.EMAIL && this.mailer && input.email) {
        await this.mailer.sendMail({
          from: this.config.get<string>('SMTP_FROM'),
          to: input.email,
          subject: input.title,
          text: input.body,
        });
      }
      if (input.channel === NotificationChannel.PUSH && this.vapidConfigured) {
        const subscriptions = await this.subs.find({ where: { userId: input.recipientId } });
        await Promise.all(
          subscriptions.map((s) =>
            webPush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: input.title, body: input.body, payload: input.payload ?? {} }),
            ),
          ),
        );
      }
      record.status = 'SENT';
      record.sentAt = new Date();
    } catch (err) {
      record.status = 'FAILED';
      this.logger.warn(`Notification dispatch failed: ${(err as Error).message}`);
    }
    return this.repo.save(record);
  }

  inbox(userId: string): Promise<Notification[]> {
    return this.repo.find({ where: { recipientId: userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.repo.update({ id, recipientId: userId }, { read: true });
  }

  registerPushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, ua: string) {
    return this.subs.save(
      this.subs.create({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: ua,
      }),
    );
  }

  /** Total unread count for the recipient's bell badge. */
  unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { recipientId: userId, read: false } });
  }

  /**
   * Persist an in-app notification for one user and push it to their bell.
   * High and critical priority also try email and web push when those are configured.
   */
  async notifyUser(input: {
    recipientId: string;
    topic: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    priority?: NotificationPriority;
  }): Promise<void> {
    const priority = input.priority ?? 'HIGH';
    const record = await this.repo.save(
      this.repo.create({
        recipientId: input.recipientId,
        channel: NotificationChannel.IN_APP,
        topic: input.topic,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
        priority,
        status: 'SENT',
        sentAt: new Date(),
      }),
    );
    this.realtime.emitToUser(record.recipientId, 'notification:new', {
      id: record.id,
      topic: record.topic,
      title: record.title,
      body: record.body,
      priority: record.priority,
      payload: record.payload,
      createdAt: record.createdAt,
    });
    const recipient = await this.users.findOne({ where: { id: input.recipientId } });
    if (!recipient) return;
    void this.dispatchSecondaryChannels([recipient], {
      topic: input.topic,
      title: input.title,
      body: input.body,
      regionId: recipient.regionId ?? '',
      payload: input.payload,
      priority,
    }).catch((err) => {
      this.logger.warn(`Secondary channel dispatch failed: ${(err as Error).message}`);
    });
  }

  /**
   * Fan a domain event out to every user whose hierarchical scope intersects
   * with the event's region / district:
   *
   *   • SYS_ADMIN + Head Office safety / Head Office SHE → always notified
   *   • REGIONAL_USER  → notified when regionId matches the event
   *   • DISTRICT_USER  → notified when districtId matches the event
   *
   * For each recipient we:
   *   1. Persist an IN_APP `Notification` row so it shows up in their inbox
   *      next time they open the bell menu, even if they were offline.
   *   2. Push a `notification:new` Socket.IO event so a connected client can
   *      surface it instantly without a polling refresh.
   *
   * Returns the number of users actually notified — useful for tests and
   * the audit trail.
   */
  async broadcastToScope(input: BroadcastInput): Promise<number> {
    const recipients = await this.findRecipients(
      input.regionId,
      input.districtId ?? null,
      input.excludeUserId,
    );
    if (!recipients.length) {
      this.logger.debug(
        `broadcastToScope(${input.topic}) found no recipients ` +
          `(region=${input.regionId} district=${input.districtId ?? '-'})`,
      );
      return 0;
    }

    const priority = input.priority ?? 'NORMAL';
    const rows = recipients.map((u) =>
      this.repo.create({
        recipientId: u.id,
        channel: NotificationChannel.IN_APP,
        topic: input.topic,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
        priority,
        status: 'SENT',
        sentAt: new Date(),
      }),
    );
    const saved = await this.repo.save(rows);

    // Push each user their own notification on the Socket.IO `user:<id>` room.
    // The frontend listens for `notification:new` and prepends to its store.
    for (const n of saved) {
      this.realtime.emitToUser(n.recipientId, 'notification:new', {
        id: n.id,
        topic: n.topic,
        title: n.title,
        body: n.body,
        priority: n.priority,
        payload: n.payload,
        createdAt: n.createdAt,
      });
    }

    // Best-effort secondary channels (won't block on transport errors).
    void this.dispatchSecondaryChannels(recipients, input).catch((err) => {
      this.logger.warn(`Secondary channel dispatch failed: ${(err as Error).message}`);
    });

    return saved.length;
  }

  private async findRecipients(
    regionId: string,
    districtId: string | null,
    excludeUserId?: string,
  ): Promise<User[]> {
    const qb = this.users
      .createQueryBuilder('u')
      .where('u.active = :active', { active: true })
      .andWhere(
        // Head Office safety and admin see everything; regional officers and staff
        // are scoped to the region; district officers and staff to the district.
        '(u.role IN (:...broad) OR (u.role IN (:...regional) AND u.regionId = :regionId) ' +
          'OR (u.role IN (:...district) AND u.districtId = :districtId))',
        {
          broad: [Role.SYS_ADMIN, ...HEAD_OFFICE_OFFICER_ROLES],
          regional: [Role.REGIONAL_USER, Role.REGIONAL_SAFETY_OFFICER],
          regionId,
          district: [Role.DISTRICT_USER, Role.DISTRICT_SAFETY_OFFICER],
          districtId: districtId ?? '__none__',
        },
      );
    if (excludeUserId) {
      qb.andWhere('u.id <> :excludeUserId', { excludeUserId });
    }
    return qb.getMany();
  }

  private async dispatchSecondaryChannels(
    recipients: User[],
    input: BroadcastInput,
  ): Promise<void> {
    const priority = input.priority ?? 'NORMAL';
    const isHigh = priority === 'HIGH' || priority === 'CRITICAL';

    if (this.mailer && isHigh) {
      const emails = recipients.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        try {
          await this.mailer.sendMail({
            from: this.config.get<string>('SMTP_FROM'),
            to: emails.join(', '),
            subject: `[ECG SHE] ${input.title}`,
            text: input.body,
          });
        } catch (err) {
          this.logger.warn(`SMTP send failed: ${(err as Error).message}`);
        }
      }
    }

    if (this.vapidConfigured) {
      const userIds = recipients.map((u) => u.id);
      const subs = userIds.length
        ? await this.subs.find({ where: { userId: In(userIds) } })
        : [];
      await Promise.all(
        subs.map((s) =>
          webPush
            .sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({
                title: input.title,
                body: input.body,
                payload: input.payload ?? {},
              }),
            )
            .catch((err) =>
              this.logger.debug(`Push send failed for ${s.endpoint}: ${(err as Error).message}`),
            ),
        ),
      );
    }
  }
}
