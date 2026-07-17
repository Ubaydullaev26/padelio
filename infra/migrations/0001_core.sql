-- 0001_core: ядро домена — каталог, пользователи, бронирования.
-- Ключевое решение (ADR-3, docs/08): конфликт броней невозможен на уровне БД —
-- EXCLUDE-констрейнт по пересечению интервалов корта для активных статусов.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- Справочники и каталог ----------

CREATE TABLE cities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Tashkent',
  center_lat  double precision,
  center_lng  double precision,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE club_status AS ENUM ('draft', 'active', 'paused', 'blocked');

CREATE TABLE clubs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id              uuid NOT NULL REFERENCES cities(id),
  name                 text NOT NULL,
  slug                 text NOT NULL UNIQUE,
  description          jsonb NOT NULL DEFAULT '{}'::jsonb, -- i18n: {"ru": "...", "uz": "..."}
  lat                  double precision,
  lng                  double precision,
  address              jsonb NOT NULL DEFAULT '{}'::jsonb,
  district             text,
  phone                text,
  telegram_contact     text,
  cancellation_policy  text NOT NULL DEFAULT 'standard', -- flexible | standard | strict
  booking_horizon_days integer NOT NULL DEFAULT 14,
  slot_step_min        integer NOT NULL DEFAULT 30,
  allow_pay_on_site    boolean NOT NULL DEFAULT true,
  confirm_timeout_min  integer NOT NULL DEFAULT 120,
  commission_rate_bp   integer NOT NULL DEFAULT 0, -- базисные пункты: 500 = 5%
  status               club_status NOT NULL DEFAULT 'draft',
  rating_avg           numeric(3, 2),
  rating_count         integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clubs_city_status_idx ON clubs (city_id, status);

CREATE TYPE sport_type AS ENUM ('padel'); -- задел: tennis, badminton — ALTER TYPE ... ADD VALUE
CREATE TYPE court_status AS ENUM ('active', 'maintenance', 'closed');

CREATE TABLE courts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES clubs(id),
  name                text NOT NULL,
  sport               sport_type NOT NULL DEFAULT 'padel',
  indoor              boolean NOT NULL DEFAULT true,
  surface             text,
  has_panoramic_glass boolean NOT NULL DEFAULT false,
  status              court_status NOT NULL DEFAULT 'active',
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX courts_club_idx ON courts (club_id);

-- Режим работы: day_of_week (0=вс … 6=сб) ЛИБО special_date (исключение/праздник).
CREATE TABLE schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES clubs(id),
  day_of_week  smallint CHECK (day_of_week BETWEEN 0 AND 6),
  special_date date,
  open_time    time,
  close_time   time,
  is_closed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(day_of_week, special_date) = 1),
  CHECK (is_closed OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

CREATE INDEX schedules_club_idx ON schedules (club_id);

-- Тарифы: специфичные правила (court_id, узкое окно) бьют общие по priority.
CREATE TABLE pricing_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id),
  court_id       uuid REFERENCES courts(id), -- NULL = все корты клуба
  day_mask       integer NOT NULL DEFAULT 127, -- битовая маска дней недели, бит 0 = воскресенье
  time_from      time NOT NULL,
  time_to        time NOT NULL,
  price_per_hour bigint NOT NULL CHECK (price_per_hour >= 0), -- тийины
  priority       integer NOT NULL DEFAULT 0,
  valid_from     date,
  valid_to       date,
  discount_pct   smallint CHECK (discount_pct BETWEEN 0 AND 100),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pricing_rules_club_idx ON pricing_rules (club_id);

-- Блокировки слотов клубом (ремонт, турнир, своя секция).
CREATE TABLE court_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id   uuid NOT NULL REFERENCES courts(id),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE INDEX court_blocks_court_time_idx ON court_blocks (court_id, starts_at);

-- ---------- Пользователи ----------

CREATE TYPE user_status AS ENUM ('active', 'restricted', 'banned');

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id        bigint UNIQUE,
  phone              text UNIQUE,
  phone_verified_at  timestamptz,
  first_name         text,
  last_name          text,
  username           text,
  language           text NOT NULL DEFAULT 'ru' CHECK (language IN ('uz', 'ru', 'en')),
  referral_code      text UNIQUE,
  referred_by        uuid REFERENCES users(id),
  no_show_count      integer NOT NULL DEFAULT 0,
  status             user_status NOT NULL DEFAULT 'active',
  notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

-- ---------- Бронирования ----------

CREATE TYPE reservation_status AS ENUM (
  'hold',           -- слот удержан на время оформления оплаты
  'pending_club',   -- «оплата на месте», ждёт подтверждения клуба
  'confirmed',
  'checked_in',
  'completed',
  'cancelled_user',
  'cancelled_club',
  'no_show',
  'expired',        -- hold истёк
  'rejected'        -- клуб отклонил / таймаут подтверждения
);

CREATE TYPE payment_method AS ENUM ('online', 'on_site', 'wallet', 'mixed', 'subscription');
CREATE TYPE reservation_source AS ENUM ('miniapp', 'club_admin', 'recurring', 'waitlist', 'platform');

CREATE TABLE reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id         uuid NOT NULL REFERENCES courts(id),
  club_id          uuid NOT NULL REFERENCES clubs(id), -- денормализация для отчётов клуба
  user_id          uuid REFERENCES users(id),          -- NULL для офлайн-брони гостя
  guest_name       text,
  guest_phone      text,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  status           reservation_status NOT NULL DEFAULT 'hold',
  hold_expires_at  timestamptz,
  price_total      bigint NOT NULL DEFAULT 0 CHECK (price_total >= 0), -- тийины
  price_court      bigint NOT NULL DEFAULT 0,
  discount_total   bigint NOT NULL DEFAULT 0,
  payment_method   payment_method,
  source           reservation_source NOT NULL DEFAULT 'miniapp',
  cancellation_reason text,
  checked_in_at    timestamptz,
  idempotency_key  text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);

-- ГЛАВНЫЙ ИНВАРИАНТ СИСТЕМЫ: активные брони одного корта не пересекаются во времени.
-- '[)' — полуоткрытый интервал: слоты 18:00–19:00 и 19:00–20:00 НЕ конфликтуют.
ALTER TABLE reservations
  ADD CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('hold', 'pending_club', 'confirmed', 'checked_in'));

CREATE INDEX reservations_court_time_idx ON reservations (court_id, starts_at);
CREATE INDEX reservations_user_idx ON reservations (user_id, starts_at DESC);
CREATE INDEX reservations_club_time_idx ON reservations (club_id, starts_at);
CREATE INDEX reservations_hold_expiry_idx ON reservations (hold_expires_at)
  WHERE status = 'hold';

-- Журнал событий брони (append-only) — источник правды для разбора споров.
CREATE TABLE reservation_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  event          text NOT NULL,
  actor_type     text NOT NULL CHECK (actor_type IN ('user', 'club', 'system', 'support')),
  actor_id       uuid,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reservation_events_res_idx ON reservation_events (reservation_id, created_at);
