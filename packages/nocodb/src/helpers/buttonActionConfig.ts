import {
  ButtonActionsType,
  isSystemColumn,
  isVirtualCol,
  parseProp,
  UITypes,
} from 'nocodb-sdk';
import type {
  ButtonActionConfig,
  ButtonConfirmation,
  ColumnType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

const BUTTON_COLORS = [
  'brand',
  'red',
  'green',
  'maroon',
  'blue',
  'orange',
  'pink',
  'purple',
  'yellow',
  'gray',
];

// No inline value to set — mirrors the editor's field list.
const NON_ASSIGNABLE_TYPES = new Set<string>([
  UITypes.Attachment,
  UITypes.Button,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.ID,
  UITypes.AutoNumber,
  UITypes.UUID,
]);

/** Fields an Update-record button may set. */
export function isButtonAssignableColumn(column: ColumnType) {
  return (
    !column.pk &&
    !isSystemColumn(column) &&
    !isVirtualCol(column) &&
    !NON_ASSIGNABLE_TYPES.has(column.uidt as string)
  );
}

function text(value: unknown, field: string, context: NcContext) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 255) {
    NcError.get(context).invalidRequestBody(
      `'${field}' must be text of at most 255 characters`,
    );
  }
  return String(value).trim() || undefined;
}

/**
 * Normalises a Button field's `action_config` against its action type and
 * table — unknown keys are dropped. Returns `undefined` when the body carries
 * none, so an edit that omits it keeps the stored config.
 */
export function normalizeButtonActionConfig(
  context: NcContext,
  {
    type,
    actionConfig,
    columns,
    dropStaleUpdates = false,
  }: {
    type: string;
    actionConfig: unknown;
    columns: ColumnType[];
    /** Stored config being carried over: drop updates whose field is gone instead of failing. */
    dropStaleUpdates?: boolean;
  },
): ButtonActionConfig | undefined {
  if (actionConfig === undefined) return undefined;

  const raw = (parseProp(actionConfig) ?? {}) as Record<string, any>;
  const config: ButtonActionConfig = {};

  if (raw.require_confirmation) config.require_confirmation = true;

  const confirmation: ButtonConfirmation = {
    title: text(raw.confirmation?.title, 'confirmation.title', context),
    message: text(raw.confirmation?.message, 'confirmation.message', context),
    button_label: text(
      raw.confirmation?.button_label,
      'confirmation.button_label',
      context,
    ),
  };
  if (confirmation.title || confirmation.message || confirmation.button_label)
    config.confirmation = JSON.parse(JSON.stringify(confirmation));

  if (type !== ButtonActionsType.UpdateRecord) return config;

  const updates = (Array.isArray(raw.updates) ? raw.updates : []).filter(
    (update: any) =>
      !dropStaleUpdates ||
      columns.some(
        (c) => c.id === update?.fk_column_id && isButtonAssignableColumn(c),
      ),
  );
  if (!updates.length) {
    NcError.get(context).invalidRequestBody(
      'An Update record button needs at least one field to set',
    );
  }

  const seen = new Set<string>();
  config.updates = updates.map((update: any) => {
    const column = columns.find((c) => c.id === update?.fk_column_id);
    if (!column) NcError.get(context).fieldNotFound(update?.fk_column_id);
    if (!isButtonAssignableColumn(column)) {
      NcError.get(context).invalidRequestBody(
        `Field '${column.title}' cannot be set by a button`,
      );
    }
    if (seen.has(column.id)) {
      NcError.get(context).invalidRequestBody(
        `Field '${column.title}' is set more than once`,
      );
    }
    seen.add(column.id);
    return { fk_column_id: column.id, value: update.value ?? null };
  });

  const after = raw.appearance_after ?? {};
  const appearanceAfter: ButtonActionConfig['appearance_after'] = {
    label: text(after.label, 'appearance_after.label', context),
    color: BUTTON_COLORS.includes(after.color) ? after.color : undefined,
    show_check_icon: after.show_check_icon === false ? false : undefined,
  };
  if (
    appearanceAfter.label ||
    appearanceAfter.color ||
    appearanceAfter.show_check_icon === false
  )
    config.appearance_after = JSON.parse(JSON.stringify(appearanceAfter));

  return config;
}
