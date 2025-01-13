import { ButtonActionsType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import { isEE } from '~/utils';

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
  model?: string;
  output_column_ids?: string;

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

    const insertObj = extractProps(buttonColumn, [
      ...(buttonColumn.type === ButtonActionsType.Url
        ? urlProps
        : buttonColumn.type === ButtonActionsType.Webhook
        ? webhookProps
        : buttonColumn.type === ButtonActionsType.Script && isEE
        ? scriptProps
        : buttonColumn.type === ButtonActionsType.Ai
        ? aiProps
        : []),
      'theme',
      'color',
      'label',
      'type',
      'icon',
      'fk_column_id',
    ]);

    if (buttonColumn.type === ButtonActionsType.Url) {
      insertObj.parsed_tree = stringifyMetaProp(insertObj, 'parsed_tree');
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
          column.parsed_tree = parseMetaProp(column, 'parsed_tree');
        }
        await NocoCache.set(`${CacheScope.COL_BUTTON}:${columnId}`, column);
      }
    }

    return column ? new ButtonColumn(column) : null;
  }

  id: string;

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

    const updateObj = extractProps(button, [
      ...(button.type === ButtonActionsType.Url
        ? urlProps
        : button.type === ButtonActionsType.Webhook
        ? webhookProps
        : button.type === ButtonActionsType.Script && isEE
        ? scriptProps
        : button.type === ButtonActionsType.Ai
        ? aiProps
        : []),
      'theme',
      'color',
      'type',
      'icon',
      'label',
    ]);

    if (button.type === ButtonActionsType.Url) {
      button.parsed_tree = stringifyMetaProp(button, 'parsed_tree');
    }

    if ('parsed_tree' in updateObj)
      updateObj.parsed_tree = stringifyMetaProp(updateObj, 'parsed_tree');
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

    await NocoCache.update(`${CacheScope.COL_BUTTON}:${columnId}`, updateObj);
  }

  public getParsedTree() {
    return this.parsed_tree;
  }
}
