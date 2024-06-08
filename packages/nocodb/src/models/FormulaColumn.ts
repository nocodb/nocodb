import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';

export default class FormulaColumn {
  formula: string;
  formula_raw: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_column_id: string;
  error: string;
  private parsed_tree?: any;

  constructor(data: Partial<FormulaColumn> & { parsed_tree?: any }) {
    const { parsed_tree, ...rest } = data;
    this.parsed_tree = parsed_tree;
    Object.assign(this, rest);
  }

  public static async insert(
    context: NcContext,
    formulaColumn: Partial<FormulaColumn> & { parsed_tree?: any },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(formulaColumn, [
      'fk_column_id',
      'formula_raw',
      'formula',
      'error',
      'parsed_tree',
    ]);

    insertObj.parsed_tree = stringifyMetaProp(insertObj, 'parsed_tree');

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_FORMULA,
      insertObj,
    );

    return this.read(context, formulaColumn.fk_column_id, ncMeta);
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_FORMULA}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_FORMULA,
        { fk_column_id: columnId },
      );
      if (column) {
        column.parsed_tree = parseMetaProp(column, 'parsed_tree');
        await NocoCache.set(`${CacheScope.COL_FORMULA}:${columnId}`, column);
      }
    }

    return column ? new FormulaColumn(column) : null;
  }

  id: string;

  static async update(
    context: NcContext,
    columnId: string,
    formula: Partial<FormulaColumn> & { parsed_tree?: any },
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(formula, [
      'formula',
      'formula_raw',
      'fk_column_id',
      'error',
      'parsed_tree',
    ]);

    if ('parsed_tree' in updateObj)
      updateObj.parsed_tree = stringifyMetaProp(updateObj, 'parsed_tree');
    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_FORMULA,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(`${CacheScope.COL_FORMULA}:${columnId}`, updateObj);
  }

  public getParsedTree() {
    return this.parsed_tree;
  }
}
