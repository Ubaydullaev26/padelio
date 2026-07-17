-- Тестовые данные для локальной разработки. НЕ применяется в production.

INSERT INTO cities (id, name, timezone, center_lat, center_lng)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ташкент', 'Asia/Tashkent', 41.3111, 69.2797)
ON CONFLICT DO NOTHING;

INSERT INTO clubs (id, city_id, name, slug, district, status, lat, lng,
                   description, address)
VALUES
  ('00000000-0000-0000-0000-00000000c1b1', '00000000-0000-0000-0000-000000000001',
   'PadelPro Tashkent', 'padelpro', 'Юнусабад', 'active', 41.3644, 69.2871,
   '{"ru": "4 крытых корта с панорамным стеклом", "uz": "Panoramik oynali 4 ta yopiq kort"}',
   '{"ru": "ул. Амира Темура, 108", "uz": "Amir Temur ko''chasi, 108"}'),
  ('00000000-0000-0000-0000-00000000c1b2', '00000000-0000-0000-0000-000000000001',
   'Matchpoint Padel', 'matchpoint', 'Мирзо-Улугбек', 'active', 41.3253, 69.3286,
   '{"ru": "2 открытых корта, кафе, парковка", "uz": "2 ta ochiq kort, kafe, avtoturargoh"}',
   '{"ru": "ул. Буюк Ипак Йули, 45", "uz": "Buyuk Ipak Yo''li ko''chasi, 45"}')
ON CONFLICT DO NOTHING;

INSERT INTO courts (id, club_id, name, indoor, has_panoramic_glass, sort_order)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c1b1', 'Корт 1', true, true, 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000c1b1', 'Корт 2', true, true, 2),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000c1b2', 'Корт 1', false, false, 1)
ON CONFLICT DO NOTHING;

-- Режим работы: ежедневно 07:00–23:00
INSERT INTO schedules (club_id, day_of_week, open_time, close_time)
SELECT c.id, d, time '07:00', time '23:00'
FROM clubs c, generate_series(0, 6) AS d
ON CONFLICT DO NOTHING;

-- Тарифы: офф-пик 200к сум/час, прайм (18:00–23:00) 300к сум/час (в тийинах ×100)
INSERT INTO pricing_rules (club_id, time_from, time_to, price_per_hour, priority)
SELECT id, time '07:00', time '18:00', 20000000, 0 FROM clubs
ON CONFLICT DO NOTHING;
INSERT INTO pricing_rules (club_id, time_from, time_to, price_per_hour, priority)
SELECT id, time '18:00', time '23:00', 30000000, 10 FROM clubs
ON CONFLICT DO NOTHING;

INSERT INTO users (id, telegram_id, first_name, language, referral_code)
VALUES ('00000000-0000-0000-0000-0000000000f1', 100000001, 'Тимур', 'ru', 'TIMUR1')
ON CONFLICT DO NOTHING;
