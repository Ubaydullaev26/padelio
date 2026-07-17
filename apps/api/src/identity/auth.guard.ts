import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { IdentityService } from './identity.service.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

/** Bearer JWT → req.userId. RBAC-проверки ролей добавятся вместе с режимом клуба. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Missing bearer token');
    try {
      req.userId = this.identity.verifySession(token).userId;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
