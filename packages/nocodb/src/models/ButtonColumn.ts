import { ButtonActionsType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import { isEE } from '~/utils';
import Filter from '~/models/Filter';

export default class ButtonColumn {
  type: ButtonActionsType;
  label: string;
  theme: 'solid' | 'light' | 'text';
  icon?: string;
  color: string;
  fk_webhook_id?: string;
  formula?: string;
  formula_raw?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_column_id: string;
  error?: string;

  fk_integration_id?: string;
  fk_script_id?: string;
  fk_form_view_id?: string;
  model?: string;
  output_column_ids?: string;
  filters?: any[];
  id: string;

  private parsed_tree?: any;

  constructor(data: Partial<ButtonColumn> & { parsed_tree?: any }) {
    const { parsed_tree, ...rest } = data;
    this.parsed_tree = parsed_tree;
    Object.assign(this, rest);
  }

  public static async insert(
    context: NcContext,
    buttonColumn: Partial<ButtonColumn> & { parsed_tree?: any },
    ncMeta = Noco.ncMeta,
  ) {
    const urlProps = ['formula_raw', 'formula', 'error', 'parsed_tree'];

    const webhookProps = ['fk_webhook_id'];

    const scriptProps = ['fk_script_id'];

    const aiProps = [
      'formula_raw',
      'formula',
      'error',
      'fk_integration_id',
      'model',
      'output_column_ids',
    ];

    const openFormProps = ['fk_form_view_id'];

    // Only the props for the selected button type are persisted; switching
    // types (e.g. URL → OpenForm) silently drops fields that no longer apply
    // so stale config doesn't leak into unrelated action paths.
    const insertObj = extractProps(buttonColumn, [
      ...(buttonColumn.type === ButtonActionsType.Url
        ? urlProps
        : buttonColumn.type === ButtonActionsType.Webhook
        ? webhookProps
        : buttonColumn.type === ButtonActionsType.Script && isEE
        ? scriptProps
        : buttonColumn.type === ButtonActionsType.Ai
        ? aiProps
        : buttonColumn.type === ButtonActionsType.OpenForm
        ? openFormProps
        : []),
      'theme',
      'color',
      'label',
      'type',
      'icon',
      'fk_column_id',
    ]);

    if (buttonColumn.type === ButtonActionsType.Url) {
      insertObj.parsed_tree = stringifyMetaProp(insertObj, 'parsed_tree', null);
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BUTTON,
      insertObj,
    );

    return this.read(context, buttonColumn.fk_column_id, ncMeta);
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        context,
        `${CacheScope.COL_BUTTON}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_BUTTON,
        { fk_column_id: columnId },
      );
      if (column) {
        if (column.type === ButtonActionsType.Url) {
          column.parsed_tree = parseMetaProp(column, 'parsed_tree', null);
        }
        await NocoCache.set(
          context,
          `${CacheScope.COL_BUTTON}:${columnId}`,
          column,
        );
      }
    }

    if (column) {
      column.filters = await Filter.allButtonFilterList(
        context,
        { buttonColId: columnId },
        ncMeta,
      );
    }

    return column ? new ButtonColumn(column) : null;
  }

  static async update(
    context: NcContext,
    columnId: string,
    button: Partial<ButtonColumn> & { parsed_tree?: any },
    ncMeta = Noco.ncMeta,
  ) {
    const urlProps = [
      'fk_column_id',
      'formula_raw',
      'formula',
      'error',
      'parsed_tree',
    ];

    const webhookProps = ['fk_webhook_id'];

    const scriptProps = ['fk_script_id'];

    const aiProps = [
      'formula_raw',
      'formula',
      'error',
      'fk_integration_id',
      'model',
      'output_column_ids',
    ];

    const openFormProps = ['fk_form_view_id'];

    const updateObj = extractProps(button, [
      ...(button.type === ButtonActionsType.Url
        ? urlProps
        : button.type === ButtonActionsType.Webhook
        ? webhookProps
        : button.type === ButtonActionsType.Script && isEE
        ? scriptProps
        : button.type === ButtonActionsType.Ai
        ? aiProps
        : button.type === ButtonActionsType.OpenForm
        ? openFormProps
        : []),
      'theme',
      'color',
      'type',
      'icon',
      'label',
    ]);

    if (button.type === ButtonActionsType.Url) {
      button.parsed_tree = stringifyMetaProp(button, 'parsed_tree', null);
    }

    if ('parsed_tree' in updateObj)
      updateObj.parsed_tree = stringifyMetaProp(updateObj, 'parsed_tree', null);

    // Null out any type-specific fields that no longer apply after the type
    // change. Without this, switching (e.g.) OpenForm → Url would leave a
    // stale fk_form_view_id in the row, which the invalid-column heuristic
    // could then mis-read. `formula_*` / `error` are shared between Url and
    // Ai, so they're preserved for both; `parsed_tree` is Url-only.
    if (button.type) {
      const sharedFormulaTypes = new Set<string>([
        ButtonActionsType.Url,
        ButtonActionsType.Ai,
      ]);

      if (!sharedFormulaTypes.has(button.type)) {
        updateObj.formula = null;
        updateObj.formula_raw = null;
        updateObj.error = null;
      }
      if (button.type !== ButtonActionsType.Url) {
        updateObj.parsed_tree = null;
      }
      if (button.type !== ButtonActionsType.Webhook) {
        updateObj.fk_webhook_id = null;
      }
      if (button.type !== ButtonActionsType.Script) {
        updateObj.fk_script_id = null;
      }
      if (button.type !== ButtonActionsType.OpenForm) {
        updateObj.fk_form_view_id = null;
      }
      if (button.type !== ButtonActionsType.Ai) {
        updateObj.fk_integration_id = null;
        updateObj.model = null;
        updateObj.output_column_ids = null;
      }
    }

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BUTTON,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.COL_BUTTON}:${columnId}`,
      updateObj,
    );
  }

  public getParsedTree() {
    return this.parsed_tree;
  }

  public static async buttonUsages(
    context: NcContext,
    scriptId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BUTTON,
      {
        condition: { fk_script_id: scriptId },
      },
    );
  }
}
