import { Body, Controller, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { IdentityService, type AuthResult } from './identity.service.js';
import { InvalidInitDataError } from './initdata.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  /** Вход Mini App: тело { initData } → { token, user, startParam }. */
  @Post('telegram')
  @HttpCode(200)
  async telegram(@Body() body: { initData?: string }): Promise<AuthResult> {
    try {
      return await this.identity.authenticateTelegram(body.initData ?? '');
    } catch (e) {
      if (e instanceof InvalidInitDataError) throw new UnauthorizedException(e.message);
      throw e;
    }
  }
}
