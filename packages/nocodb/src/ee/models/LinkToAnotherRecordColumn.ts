import LinkToAnotherRecordColumnCE from 'src/models/LinkToAnotherRecordColumn';
import type { BoolType } from 'nocodb-sdk';
import type Model from '~/models/Model';
import type Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheScope, MetaTable } from '~/utils/globals';
import { Filter } from '~/models';

export default class LinkToAnotherRecordColumn extends LinkToAnotherRecordColumnCE {
  id: string;
  fk_column_id: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_mm_child_column_id?: string;
  fk_mm_parent_column_id?: string;
  fk_related_model_id?: string;

  fk_target_view_id?: string | null;

  dr?: string;
  ur?: string;
  fk_index_name?: string;

  type: 'hm' | 'bt' | 'mm' | 'oo';
  virtual: BoolType = false;

  mmModel?: Model;
  relatedTable?: Model;
  // childModel?: Model;
  // parentModel?: Model;
  mmChildColumn?: Column;
  mmParentColumn?: Column;
  childColumn?: Column;
  parentColumn?: Column;

  filter?: Filter;

  constructor(data: Partial<LinkToAnotherRecordColumn>) {
    super(data);
  }

  public static async update(
    columnId: string,
    updateBody: Partial<LinkToAnotherRecordColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!columnId) return;
    const updateProps = extractProps(updateBody, ['fk_target_view_id']);
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COL_RELATIONS,
      updateProps,
      { fk_column_id: columnId },
    );

    await NocoCache.update(
      `${CacheScope.COL_RELATION}:${columnId}`,
      updateProps,
    );

    return res;
  }

  public async getFilters(ncMeta = Noco.ncMeta) {
    return (this.filter = (await Filter.getFilterObject(
      {
        linkColId: this.fk_column_id,
      },
      ncMeta,
    )) as any);
  }
}
