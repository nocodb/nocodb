import type { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '~/utils/globals';
import View from '~/models/View';
import Hook from '~/models/Hook';
import Column from '~/models/Column';

// before 0.101.0, an incorrect base_id was inserted when
// a filter is created without specifying the column
// this upgrader is to retrieve the correct base id from either view, hook, or column
// and update the base id
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  for (const filter of filters) {
    let model: { base_id?: string; source_id?: string };
    if (filter.fk_view_id) {
      model = await View.get(filter.fk_view_id, ncMeta);
    } else if (filter.fk_hook_id) {
      model = await Hook.get(filter.fk_hook_id, ncMeta);
    } else if (filter.fk_column_id) {
      model = await Column.get({ colId: filter.fk_column_id }, ncMeta);
    } else {
      continue;
    }

    // skip if related model is not found
    if (!model) {
      continue;
    }

    if (filter.base_id !== model.base_id) {
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.FILTER_EXP,
        { source_id: model.source_id, base_id: model.base_id },
        filter.id,
      );
    }
  }
}
