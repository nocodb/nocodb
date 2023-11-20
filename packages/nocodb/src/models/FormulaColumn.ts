import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class FormulaColumn {
  formula: string;
  formula_raw: string;
  fk_column_id: string;
  error: string;

  constructor(data: Partial<FormulaColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    formulaColumn: Partial<FormulaColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(formulaColumn, [
      'fk_column_id',
      'formula_raw',
      'formula',
      'error',
    ]);
    await ncMeta.metaInsert2(null, null, MetaTable.COL_FORMULA, insertObj);

    return this.read(formulaColumn.fk_column_id, ncMeta);
  }
  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_FORMULA}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_FORMULA,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_FORMULA}:${columnId}`, column);
    }

    return column ? new FormulaColumn(column) : null;
  }

  id: string;

  static async update(
    id: string,
    formula: Partial<FormulaColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(formula, [
      'formula',
      'formula_raw',
      'fk_column_id',
      'error',
    ]);
    // get existing cache
    const key = `${CacheScope.COL_FORMULA}:${id}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.COL_FORMULA, updateObj, id);
  }
}
