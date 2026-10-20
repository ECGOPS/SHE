import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import type { AuthUser } from '@ecg-she/shared';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  inbox(@CurrentUser('id') userId: string) {
    return this.svc.inbox(userId);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('id') userId: string) {
    return { count: await this.svc.unreadCount(userId) };
  }

  @Patch(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.markRead(userId, id);
  }

  @Post('push/subscribe')
  subscribe(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') ua: string,
    @Body() sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.svc.registerPushSubscription(user.id, sub, ua ?? '');
  }
}
