import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@ecg-she/shared';
import { Public } from '../../common/decorators/public.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFreshAuth } from '../auth/fresh-auth.decorator';
import { PrivacyService } from './privacy.service';
import { ConsentDto, CorrectProfileDto } from './dto/privacy.dto';

@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Public()
  @Get('notice')
  notice() {
    return this.privacy.notice();
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() actor: AuthUser) {
    return this.privacy.profile(actor);
  }

  @ApiBearerAuth()
  @Get('me/export')
  @Audit('PRIVACY_EXPORT')
  exportMine(@CurrentUser() actor: AuthUser) {
    return this.privacy.exportFor(actor);
  }

  @ApiBearerAuth()
  @Post('me/consent')
  @Audit('PRIVACY_CONSENT')
  accept(@CurrentUser() actor: AuthUser, @Body() dto: ConsentDto) {
    return this.privacy.accept(actor, dto);
  }

  @ApiBearerAuth()
  @Post('me/withdraw')
  @Audit('PRIVACY_WITHDRAW')
  withdraw(@CurrentUser() actor: AuthUser) {
    return this.privacy.withdrawOptionalContact(actor);
  }

  @ApiBearerAuth()
  @Patch('me')
  @Audit('PRIVACY_CORRECT')
  correct(@CurrentUser() actor: AuthUser, @Body() dto: CorrectProfileDto) {
    return this.privacy.correct(actor, dto);
  }

  @ApiBearerAuth()
  @Post('me/erasure')
  @RequireFreshAuth()
  @Audit('PRIVACY_ERASURE')
  erase(@CurrentUser() actor: AuthUser) {
    return this.privacy.erase(actor);
  }
}
