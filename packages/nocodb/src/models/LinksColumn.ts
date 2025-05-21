import type { RollupColumn } from '~/models/';
import type { NcContext } from '~/interface/config';
import { Column } from '~/models/';
import LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import Noco from '~/Noco';

export default class LinksColumn
  extends LinkToAnotherRecordColumn
  implements RollupColumn
{
  rollup_function = 'count' as RollupColumn['rollup_function'];

  get fk_relation_column_id() {
    return this.fk_column_id;
  }
  get fk_rollup_column_id() {
    if (this.type === 'hm') {
      return this.fk_child_column_id;
    } else if (this.type === 'mm') {
      return this.fk_parent_column_id;
    }
  }

  async getRelationColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return await Column.get(context, { colId: this.fk_column_id }, ncMeta);
  }

  async getRollupColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return await Column.get(
      context,
      { colId: this.fk_rollup_column_id },
      ncMeta,
    );
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const colData = await super.read(context, columnId, ncMeta);
    return colData && new LinksColumn(colData);
  }

  public static async insert(
    context: NcContext,
    data: Partial<LinksColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const colData = await super.insert(context, data, ncMeta);
    return colData && new LinksColumn(colData);
  }
}
