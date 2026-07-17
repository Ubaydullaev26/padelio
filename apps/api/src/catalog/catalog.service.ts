import type { Pool } from 'pg';

export interface ClubListItem {
  id: string;
  name: string;
  slug: string;
  district: string | null;
  lat: number | null;
  lng: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  courtsCount: number;
  priceFrom: number | null; // тийины, минимальная цена часа
}

export interface ClubDetails extends ClubListItem {
  description: Record<string, string>;
  address: Record<string, string>;
  phone: string | null;
  telegramContact: string | null;
  cancellationPolicy: string;
  courts: Array<{
    id: string;
    name: string;
    indoor: boolean;
    hasPanoramicGlass: boolean;
  }>;
}

/** Каталог: только чтение, только активные клубы. Расписание слотов — модуль booking (Sprint 2). */
export class CatalogService {
  constructor(private readonly pool: Pool) {}

  async listClubs(): Promise<ClubListItem[]> {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.name, c.slug, c.district, c.lat, c.lng,
              c.rating_avg, c.rating_count,
              count(DISTINCT ct.id) FILTER (WHERE ct.status = 'active')::int AS courts_count,
              min(pr.price_per_hour)::bigint AS price_from
         FROM clubs c
         LEFT JOIN courts ct ON ct.club_id = c.id
         LEFT JOIN pricing_rules pr ON pr.club_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id
        ORDER BY c.rating_avg DESC NULLS LAST, c.name`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      district: r.district,
      lat: r.lat,
      lng: r.lng,
      ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
      ratingCount: r.rating_count,
      courtsCount: r.courts_count,
      priceFrom: r.price_from === null ? null : Number(r.price_from),
    }));
  }

  async getClubBySlug(slug: string): Promise<ClubDetails | null> {
    const { rows } = await this.pool.query(
      `SELECT c.*,
              coalesce(min(pr.price_per_hour)::bigint, NULL) AS price_from
         FROM clubs c
         LEFT JOIN pricing_rules pr ON pr.club_id = c.id
        WHERE c.slug = $1 AND c.status = 'active'
        GROUP BY c.id`,
      [slug],
    );
    const club = rows[0];
    if (!club) return null;

    const courts = await this.pool.query(
      `SELECT id, name, indoor, has_panoramic_glass
         FROM courts WHERE club_id = $1 AND status = 'active'
        ORDER BY sort_order, name`,
      [club.id],
    );

    return {
      id: club.id,
      name: club.name,
      slug: club.slug,
      district: club.district,
      lat: club.lat,
      lng: club.lng,
      ratingAvg: club.rating_avg === null ? null : Number(club.rating_avg),
      ratingCount: club.rating_count,
      courtsCount: courts.rowCount ?? 0,
      priceFrom: club.price_from === null ? null : Number(club.price_from),
      description: club.description,
      address: club.address,
      phone: club.phone,
      telegramContact: club.telegram_contact,
      cancellationPolicy: club.cancellation_policy,
      courts: courts.rows.map((ct) => ({
        id: ct.id,
        name: ct.name,
        indoor: ct.indoor,
        hasPanoramicGlass: ct.has_panoramic_glass,
      })),
    };
  }
}
