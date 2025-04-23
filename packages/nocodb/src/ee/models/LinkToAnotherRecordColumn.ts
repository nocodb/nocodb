import LinkToAnotherRecordColumnCE from 'src/models/LinkToAnotherRecordColumn';
import type { BoolType } from 'nocodb-sdk';
import type Model from '~/models/Model';
import type Column from '~/models/Column';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheScope, MetaTable } from '~/utils/globals';
import { Filter } from '~/models';
import { MetaService } from '~/meta/meta.service';

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
  virtual: BoolType;

  mmModel?: Model;
  relatedTable?: Model;
  // childModel?: Model;
  // parentModel?: Model;
  mmChildColumn?: Column;
  mmParentColumn?: Column;
  childColumn?: Column;
  parentColumn?: Column;

  filter?: Filter;

  fk_related_source_id?: string;
  fk_related_base_id?: string;
  fk_mm_source_id?: string;
  fk_mm_base_id?: string;

  constructor(data: Partial<LinkToAnotherRecordColumn>) {
    super(data);
  }

  public static async update(
    context: NcContext,
    columnId: string,
    updateBody: Partial<LinkToAnotherRecordColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!columnId) return;
    const updateProps = extractProps(updateBody, ['fk_target_view_id']);
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
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

  public async getFilters(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.filter = (await Filter.getFilterObject(
      context,
      {
        linkColId: this.fk_column_id,
      },
      ncMeta,
    )) as any);
  }

  static async isUsedInCustomLink(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return !!(await ncMeta
      .knex(MetaTable.COL_RELATIONS)
      .select('id')
      .where({ fk_parent_column_id: columnId })
      .orWhere({ fk_child_column_id: columnId })
      .orWhere({ fk_mm_parent_column_id: columnId })
      .orWhere({ fk_mm_child_column_id: columnId })
      .first());
  }

   getRelatedTableContext(context: NcContext) {
    if (!this.fk_related_source_id && !this.fk_related_base_id) {
      return context;
    }

    return {
      ...context,
      base_id: this.fk_related_base_id,
      source_id: this.fk_related_source_id,
    };
  }

  async getMmTableContext(context: NcContext) {
    if (!this.fk_mm_source_id && !this.fk_mm_base_id) {
      return context;
    }

    return {
      ...context,
      base_id: this.fk_mm_base_id,
      source_id: this.fk_mm_source_id,
    };
  }
}
