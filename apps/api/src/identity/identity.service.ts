import type { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { verifyTelegramInitData, type TelegramInitUser } from './initdata.js';

export interface SessionUser {
  id: string;
  telegramId: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  language: 'uz' | 'ru' | 'en';
  phone: string | null;
  referralCode: string | null;
}

export interface AuthResult {
  token: string;
  user: SessionUser;
  startParam?: string;
}

interface UserRow {
  id: string;
  telegram_id: string; // bigint приходит строкой
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  language: 'uz' | 'ru' | 'en';
  phone: string | null;
  referral_code: string | null;
}

function mapUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    telegramId: Number(row.telegram_id),
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    language: row.language,
    phone: row.phone,
    referralCode: row.referral_code,
  };
}

function languageFrom(code: string | undefined): 'uz' | 'ru' | 'en' {
  if (!code) return 'ru';
  if (code.startsWith('uz')) return 'uz';
  if (code.startsWith('en')) return 'en';
  return 'ru';
}

export interface IdentityConfig {
  botToken: string;
  jwtSecret: string;
  /** Срок жизни сессии; initData валидна 24 ч (см. initdata.ts). */
  jwtTtlSec?: number;
}

/**
 * Аутентификация Mini App: проверка initData → upsert пользователя по telegram_id →
 * короткоживущий сессионный JWT. Пароля и регистрации нет — это суть продукта (docs/01).
 */
export class IdentityService {
  private readonly jwtTtlSec: number;

  constructor(
    private readonly pool: Pool,
    private readonly config: IdentityConfig,
  ) {
    this.jwtTtlSec = config.jwtTtlSec ?? 24 * 60 * 60;
  }

  async authenticateTelegram(initData: string): Promise<AuthResult> {
    const verified = verifyTelegramInitData(initData, this.config.botToken);
    const user = await this.upsertUser(verified.user);
    const token = jwt.sign(
      { sub: user.id, tg: user.telegramId },
      this.config.jwtSecret,
      { expiresIn: this.jwtTtlSec },
    );
    return { token, user, startParam: verified.startParam };
  }

  verifySession(token: string): { userId: string } {
    const payload = jwt.verify(token, this.config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) throw new jwt.JsonWebTokenError('sub is missing');
    return { userId: payload.sub };
  }

  /** Идемпотентный upsert: профиль обновляется из Telegram при каждом входе. */
  private async upsertUser(tg: TelegramInitUser): Promise<SessionUser> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (telegram_id, first_name, last_name, username, language, referral_code)
       VALUES ($1, $2, $3, $4, $5, upper(substr(md5(random()::text), 1, 8)))
       ON CONFLICT (telegram_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name  = EXCLUDED.last_name,
         username   = EXCLUDED.username,
         updated_at = now()
       RETURNING *`,
      [
        tg.id,
        tg.first_name ?? null,
        tg.last_name ?? null,
        tg.username ?? null,
        languageFrom(tg.language_code),
      ],
    );
    return mapUser(rows[0]!);
  }
}
