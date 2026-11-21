import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Each user arranges their own base list: their `base_users.order` takes the place of the shared
 * base order, which stays the default for bases they haven't moved. Rows are copied, never edited,
 * because list rows can be cache-shared across users.
 */
export async function applyUserBaseOrder<
  T extends { id?: string; order?: number | null },
>(userId: string | undefined, bases: T[], ncMeta = Noco.ncMeta): Promise<T[]> {
  if (!userId || !bases.length) return bases;

  const rows: { base_id: string; order: number }[] = await ncMeta
    .knex(MetaTable.PROJECT_USERS)
    .select('base_id', 'order')
    .where('fk_user_id', userId)
    .whereIn(
      'base_id',
      bases.map((base) => base.id),
    )
    .whereNotNull('order');

  if (!rows.length) return bases;

  const own = new Map(rows.map((row) => [row.base_id, +row.order]));

  return bases
    .map((base, index) => {
      const order = own.has(base.id) ? own.get(base.id) : base.order;
      const copy = Object.assign(
        Object.create(Object.getPrototypeOf(base)),
        base,
        { order },
      ) as T;
      return { copy, order, index };
    })
    .sort(
      (a, b) =>
        (a.order ?? Infinity) - (b.order ?? Infinity) || a.index - b.index,
    )
    .map(({ copy }) => copy);
}
