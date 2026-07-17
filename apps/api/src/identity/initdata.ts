import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Валидация Telegram Mini App initData (docs/08 §4):
 * секрет = HMAC_SHA256(key="WebAppData", msg=bot_token);
 * hash = HMAC_SHA256(key=секрет, msg=data_check_string) — строки key=value
 * (кроме hash), отсортированные и склеенные через \n.
 * Проверяем подпись, TTL auth_date и возвращаем распарсенного пользователя.
 */

export class InvalidInitDataError extends Error {
  constructor(message = 'Invalid Telegram initData') {
    super(message);
    this.name = 'InvalidInitDataError';
  }
}

export interface TelegramInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramInitUser;
  authDate: Date;
  startParam?: string;
  queryId?: string;
}

export const DEFAULT_INITDATA_MAX_AGE_SEC = 24 * 60 * 60;

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number = DEFAULT_INITDATA_MAX_AGE_SEC,
  now: Date = new Date(),
): VerifiedInitData {
  if (!initData) throw new InvalidInitDataError('initData is empty');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new InvalidInitDataError('hash is missing');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new InvalidInitDataError('signature mismatch');
  }

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) throw new InvalidInitDataError('auth_date is missing');
  const authDate = new Date(Number(authDateRaw) * 1000);
  if (!Number.isFinite(authDate.getTime())) throw new InvalidInitDataError('auth_date is invalid');
  const ageSec = (now.getTime() - authDate.getTime()) / 1000;
  if (ageSec > maxAgeSec || ageSec < -300) {
    throw new InvalidInitDataError('initData expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new InvalidInitDataError('user is missing');
  let user: TelegramInitUser;
  try {
    user = JSON.parse(userRaw) as TelegramInitUser;
  } catch {
    throw new InvalidInitDataError('user is not valid JSON');
  }
  if (typeof user.id !== 'number') throw new InvalidInitDataError('user.id is missing');

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
  };
}

/** Сборка подписанной initData-строки — для тестов и локальной разработки. */
export function buildInitData(
  botToken: string,
  user: TelegramInitUser,
  authDate: Date = new Date(),
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(Math.floor(authDate.getTime() / 1000)),
    ...extra,
  });
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}
