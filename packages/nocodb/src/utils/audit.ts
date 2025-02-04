import {
  checkboxIconList,
  durationOptions,
  isSystemColumn,
  isVirtualCol,
  ratingIconList,
  UITypes,
} from 'nocodb-sdk';
import { diff } from 'deep-object-diff';
import type {
  AuditV1,
  AuditV1OperationTypes,
  ColumnMeta,
  ColumnType,
  LinkToAnotherRecordType,
  NcContext,
  NcRequest,
  SelectOptionsType,
  UpdateDestructedPayload,
  UpdatePayload,
} from 'nocodb-sdk';
import type { Request } from 'express';
import { Column, Hook } from '~/models';
import { Model, View } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import { columnBuilder } from '~/utils/data-transformation.builder';

/**
 * Converts an array of key-value pair entries into an object.
 * @template T The type of the values in the entries.
 * @param entries An array of tuples where each tuple contains a key and a value.
 * @returns An object constructed from the provided key-value pair entries.
 */
export function fromEntries<T = any>(
  entries: [string, T][],
): { [key: string]: T } {
  return entries.reduce((acc, entry) => {
    if (!entry) return acc;
    const [key, value] = entry;
    acc[key] = value;
    return acc;
  }, {} as { [key: string]: T });
}

/**
 * Removes blank properties from an object and optionally includes null values.
 * Masks excluded properties and predefined system properties.
 * @param obj The object to process.
 * @param _excludedProps An array of property names to exclude.
 * @param includeNull Whether to include properties with null values.
 * @returns The object with blank and excluded properties removed.
 */
export const removeBlankPropsAndMask = (
  obj,
  _excludedProps: string[] = [],
  includeNull = false,
  includeBlanks = false,
) => {
  const excludedProps = [
    ..._excludedProps,
    'created_at',
    'updated_at',
    'base_id',
    'source_id',
    'fk_workspace_id',
  ];

  if (obj === null || obj === undefined) return obj;

  return fromEntries(
    Object.entries(obj).filter(
      ([key, value]) =>
        (includeNull || value !== null) &&
        value !== undefined &&
        (includeBlanks || value !== '') &&
        (!excludedProps || !excludedProps.includes(key)),
    ),
  );
};

const systemColumns = [
  'created_at',
  'updated_at',
  'id',
  'base_id',
  'fk_workspace_id',
  'source_id',
  'is_deleted',
  'created_by',
  'updated_by',
  'deleted',
  'fk_model_id',
];

/**
 * Extracts property values from a previous object using the keys from a new object.
 * @param prev The previous object.
 * @param next The new object.
 * @returns An object containing properties from the previous object with keys matching those in the new object.
 */
export const extractPropsFromPrev = (prev, next) => {
  if (!prev || !next) return next;

  return fromEntries(Object.entries(next).map(([key]) => [key, prev[key]]));
};

/**
 * Extracts non-system properties from a given object.
 * Additional properties can be excluded, and null values can be included if specified.
 * @template T The type of the object being processed.
 * @param payload The object to extract properties from.
 * @param additionalExcludeProps Additional property names to exclude.
 * @param includeNulls Whether to include properties with null values.
 * @returns An object containing only non-system properties.
 */
export function extractNonSystemProps<T>(
  payload: T,
  additionalExcludeProps: Array<string> = [],
  includeNulls = false,
): Partial<T> {
  if (!payload || typeof payload !== 'object') return payload;
  return fromEntries(
    Object.entries(payload)
      .filter(([key, val]) => {
        return (
          (includeNulls || val !== null) &&
          !systemColumns.includes(key) &&
          !additionalExcludeProps?.includes(key)
        );
      })
      // remove fk_ prefix
      .map(([key, val]) => {
        return [key.replace(/^fk_/, ''), val];
      }),
  ) as Partial<T>;
}

/**
 * Generates an audit payload for version 1 of the audit schema.
 * Includes user and context details, operation type, and additional metadata.
 * @template T The type of the details field in the audit payload.
 * @param opType The type of operation being audited.
 * @param params Additional parameters for generating the audit payload.
 * @returns The generated audit payload.
 */
export async function generateAuditV1Payload<T = any>(
  opType: AuditV1OperationTypes,
  params: {
    details?: T & { table_title?: string };
    context?: NcContext & {
      source_id?: string;
      fk_model_id?: string;
      row_id?: string;
    };
    req?: NcRequest & Partial<Request>;
    id?: string;
    base_id?: string;
    source_id?: string;
    fk_model_id?: string;
    fk_workspace_id?: string;
    row_id?: string;
  },
): Promise<AuditV1<T>> {
  const { details, context, req, id } = params;

  // todo: handle it in a better way
  // if payload includes view_id and view_title and not table_title, then extract table_title
  if (
    details &&
    !details.table_title &&
    (params.fk_model_id || context?.fk_model_id)
  ) {
    details.table_title = (
      req?.ncModel ||
      (await Model.get(context, params.fk_model_id ?? context?.fk_model_id))
    )?.title;
  }

  return {
    user: req?.user?.email,
    ip: req?.ip,
    fk_user_id: req?.user?.id,
    user_agent: req?.headers?.['user-agent'],
    fk_workspace_id:
      params.fk_workspace_id ?? context?.workspace_id ?? req?.ncWorkspaceId,
    base_id: params.base_id ?? context?.base_id ?? req?.ncBaseId,
    source_id: params.source_id ?? context?.source_id ?? req?.ncSourceId,
    fk_model_id: params.fk_model_id ?? context?.fk_model_id,
    row_id: context?.row_id ?? params.row_id,
    op_type: opType,
    details,
    version: 1,
    fk_parent_id: id === req?.ncParentAuditId ? null : req?.ncParentAuditId,
    id,
  };
}

/**
 * Extracts metadata related to a specific column for audit logs.
 * Filters and transforms column options based on the column type and data.
 * @param colOptions The column metadata.
 * @returns An object containing extracted column metadata and options.
 */
const extractReqPropsFromColOpt = (colOptions: ColumnType['colOptions']) => {
  if (!colOptions) return undefined;

  if (Array.isArray(colOptions))
    return colOptions.map((col) => extractReqPropsFromColOpt(col));

  return Object.keys(colOptions).reduce((acc, key) => {
    if (
      ![
        'id',
        'base_id',
        'source_id',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'ur',
        'dr',
        'fk_index_name',
        'deleted',
        'fk_target_view_id',
        'fk_workspace_id',
      ].includes(key)
    ) {
      acc[key] = colOptions[key];
    }
    return acc;
  }, {});
};

/**
 * Extracts metadata for a column to render in audit logs.
 * Handles specific column types such as MultiSelect and SingleSelect,
 * filtering and formatting column options as required.
 *
 * @param column The column metadata.
 * @param datas Optional data array used to filter column options.
 * @returns An object containing extracted metadata and formatted column options.
 */
export const extractColMetaForAudit = (column: ColumnType, datas?: any[]) => {
  const colOptions = column.colOptions as SelectOptionsType;
  switch (
    column.uidt ||
    (column as unknown as { field_type?: string }).field_type
  ) {
    // extract meta for column type to render in audit logs
    // add if any custom column info is needed to extract
    // if single of multi select capture only required info
    case UITypes.MultiSelect:
    case UITypes.SingleSelect:
      {
        if (colOptions?.options?.length) {
          colOptions.options = colOptions.options
            .filter((opt) => {
              return (
                !datas?.length ||
                datas.some((d) => d[column.title]?.includes(opt.title))
              );
            })
            .map((opt) => ({
              id: opt.id,
              title: opt.title,
              color: opt.color,
            }));
        }
      }
      break;
  }

  // extract meta and other info from colOptions
  return column
    ? columnBuilder().build({
        ...column,
        // exclude id base_id, created_by, etc... from colOptions
        colOptions: colOptions
          ? extractReqPropsFromColOpt(colOptions)
          : undefined,
      } as ColumnType)
    : undefined;
};

/**
 * Extracts additional metadata corresponding to specific column types.
 * Handles cases such as Barcode, QrCode, Button, Lookup, Rollup, and Links.
 *
 * @param column The column to extract metadata from.
 * @param columns The list of columns to search within for related metadata.
 * @param context The context for accessing models and columns.
 * @returns A promise that resolves with the extracted metadata for the column.
 */
export const extractRefColumnIfFound = async ({
  column,
  columns,
  context,
}: {
  columns: ColumnType[];
  column: any;
  context: NcContext;
}) => {
  if (column.uidt === UITypes.Barcode) {
    const barcodeValueColumnId =
      column.fk_barcode_value_column_id ||
      column.colOptions?.fk_barcode_value_column_id;
    return {
      barcode_value_field_id: barcodeValueColumnId,
      barcode_value_field_title: columns.find(
        (c) => c.id === barcodeValueColumnId,
      )?.title,
    };
  }

  if (column.uidt === UITypes.QrCode) {
    const qrCodeValueColumnId =
      column.fk_qr_value_column_id || column.colOptions?.fk_qr_value_column_id;
    return {
      qr_code_value_field_id: qrCodeValueColumnId,
      qr_code_value_field_title: columns.find(
        (c) => c.id === qrCodeValueColumnId,
      )?.title,
    };
  }

  if (column.uidt === UITypes.Button) {
    const hookId = column.fk_webhook_id;

    const hook = await Hook.get(context, hookId);

    return {
      webhook_id: hookId,
      webhook_title: hook?.title,
    };
  }

  if (column.uidt === UITypes.Lookup) {
    const linkField = columns.find(
      (c) =>
        c.id ===
        (column.fk_relation_column_id ||
          column.colOptions?.fk_relation_column_id),
    );

    const lookupColumnId =
      column.fk_lookup_column_id || column.colOptions?.fk_lookup_column_id;

    const lookupTable = await Model.get(context, linkField.fk_model_id);

    const lookupColumn = await Column.get(context, { colId: lookupColumnId });

    return {
      link_field_id: linkField?.id,
      link_field_title: linkField?.title,
      // lookup_table_id: lookupTable?.id,
      // lookup_table_title: lookupTable?.title,
      // lookup_field_id: lookupColumn?.id,
      // lookup_field_title: lookupColumn?.title,

      linked_table_lookup_field_title: lookupColumn?.title,
      linked_table_id: lookupTable?.id,
      linked_table_title: lookupTable?.title,
    };
  }

  if (column.uidt === UITypes.Rollup) {
    const linkField = columns.find(
      (c) =>
        c.id ===
        (column.fk_relation_column_id ||
          column.colOptions?.fk_relation_column_id),
    );

    const rollupColumnId =
      column.fk_rollup_column_id || column.colOptions?.fk_rollup_column_id;

    const rollupTable = await Model.get(context, linkField.fk_model_id);

    const rollupColumn = await Column.get(context, { colId: rollupColumnId });

    return {
      link_field_id: linkField?.id,
      link_field_title: linkField?.title,

      // rollup_table_id: rollupTable?.id,
      // rollup_table_title: rollupTable?.title,

      rollup_field_id: rollupColumn?.id,
      rollup_field_title: rollupColumn?.title,

      linked_table_rollup_field_title: rollupColumn?.title,
      linked_table_id: rollupTable?.id,
      linked_table_title: rollupTable?.title,
    };
  }

  // if Links / LTAR column extract the ref table title and column title
  if (
    column.uidt === UITypes.Links ||
    column.uidt === UITypes.LinkToAnotherRecord
  ) {
    const refTable = await Model.get(
      context,
      column.child_id ||
        (column?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id,
    );

    let viewInfo = {};

    // extract child view info if defined
    if (column.fk_child_view_id || column.child_view_id) {
      const childView = await View.get(
        context,
        column.fk_child_view_id || column.child_view_id,
      );

      viewInfo = {
        child_view_id: childView?.id,
        child_view_title: childView?.title,
      };
    }

    return {
      ref_table_id: refTable?.id,
      ref_table_title: refTable?.title,
      ...viewInfo,
    };
  }

  return {};
};

export const additionalExcludePropsForCol = (_uidt) => [
  'title',
  'column_name',
  'altered',
  'fk_qr_value_column_id',
  'fk_barcode_value_column_id',
  'fk_relation_column_id',
  'fk_lookup_column_id',
  'fk_rollup_column_id',
  'lookup_column_title',
  'colOptions',
  'rollup_column_title',
  'parent_id',
  'child_column',
  'child_table',
  'child_id',
  'child_table_title',
  'colOptions',
];

const metaAliasMap = {
  allowCSVDownload: 'allow_csv_download',
  isLocaleString: 'locale_string',
  duration: 'duration_format',
  is12hrFormat: '12hr_format',
  fk_cover_image_object_fit: 'cover_image_object_fit',
};

/**
 * Extracts additional properties and metadata related to a view.
 * Handles properties like cover image, group-by, and calendar range.
 *
 * @param view The view metadata to process.
 * @param context The context for fetching additional metadata.
 * @returns A promise resolving to an object containing extracted properties.
 */
export const extractViewRelatedProps = async ({
  view,
  context,
}: {
  view: any;
  context: NcContext;
}) => {
  if (!view) return {};

  const result: Record<string, any> = { ...view };

  parseMetaIfFound({ payloads: [result] });

  // extract cover image column id and title
  if (
    (
      view as {
        fk_cover_image_col_id: string;
      }
    ).fk_cover_image_col_id
  ) {
    const coverImageCol = await Column.get(context, {
      colId: view.fk_cover_image_col_id,
    });
    result.cover_image_field_id = coverImageCol?.id;
    result.cover_image_field_title = coverImageCol?.title;
    result.fk_cover_image_col_id = undefined;
  }

  // extract group by column id and title
  if (
    (
      view as {
        fk_grp_col_id: string;
      }
    ).fk_grp_col_id
  ) {
    const groupByCol = await Column.get(context, { colId: view.fk_grp_col_id });
    result.group_by_field_id = groupByCol?.id;
    result.group_by_field_title = groupByCol?.title;
    result.fk_grp_col_id = undefined;
  }

  // extract calendar group by column id and title
  if (
    (
      view as {
        calendar_range: {
          fk_to_column_id: string;
          fk_from_column_id: string;
        }[];
      }
    ).calendar_range &&
    Array.isArray(view.calendar_range) &&
    view.calendar_range.length
  ) {
    const columns = await (
      await Model.get(context, view.fk_model_id)
    ).getColumns(context);
    if (columns) {
      result.calendar_range = view.calendar_range.map(
        (range: { fk_from_column_id: string; fk_to_column_id: string }) => {
          const fromColumn = columns.find(
            (c) => c.id === range.fk_from_column_id,
          );
          const toColumn = columns.find((c) => c.id === range.fk_to_column_id);

          return {
            from_field_id: fromColumn?.id,
            from_field_title: fromColumn?.title,
            to_field_id: toColumn?.id ?? null,
            to_field_title: toColumn?.title ?? null,
          };
        },
      );
    }
  }

  return result;
};

/**
 * Parses and transforms metadata in the payloads.
 * Converts specified properties to snake_case and attempts to parse JSON strings into objects.
 *
 * @param payloads The list of payload objects to process.
 * @param metaProps The list of properties to look for metadata (default: ['meta']).
 * @param propsToSnakeCase Whether to convert property names to snake_case (default: true).
 */
export function parseMetaIfFound({
  payloads,
  metaProps = ['meta'],
  propsToSnakeCase = true,
}: {
  payloads: any[];
  metaProps?: string[];
  propsToSnakeCase?: boolean;
}) {
  if (!Array.isArray(payloads)) return;

  for (const payload of payloads) {
    if (!payload) continue;
    for (const prop of metaProps) {
      if (!payload[prop]) continue;
      if (typeof payload[prop] === 'string') {
        try {
          payload[prop] = JSON.parse(payload[prop]);
        } catch {
          // do nothing
        }
      }

      if (typeof payload[prop] === 'object' && propsToSnakeCase) {
        payload[prop] = fromEntries(
          Object.entries(payload[prop]).map(([key, val]) => {
            return [
              key in metaAliasMap
                ? metaAliasMap[key]
                : key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`),
              val,
            ];
          }),
        );
      }
    }
  }
}

const propsAlias = {
  comparison_op: 'comparison_operator',
  logical_op: 'logical_operator',
  comparison_sub_op: 'comparison_sub_operator',
};

/**
 * Maps property names in the payload to their corresponding aliases.
 *
 * @param payload The object containing properties to map.
 * @returns A new object with property names replaced by their aliases if defined.
 */
export const mapAlias = (payload: any) => {
  return fromEntries(
    Object.entries(payload).map(([key, val]) => {
      return [key in propsAlias ? propsAlias[key] : key, val];
    }),
  );
};

/**
 * Populates an update payload by comparing the previous and next states.
 * Handles alias mapping, metadata parsing, and property inclusion/exclusion rules.
 *
 * @param prev The previous state object.
 * @param next The next state object.
 * @param exclude An optional list of properties to exclude.
 * @param parseMeta Whether to parse metadata properties (default: false).
 * @param metaProps The list of metadata properties to parse.
 * @param excludeNull Whether to exclude null values (default: false).
 * @param replaceAlias Whether to replace property names with aliases (default: false).
 * @param boolProps A list of boolean properties to normalize.
 * @param aliasMap A map of property aliases.
 * @param keepUnderModified Whether to include the previous state under the 'modified' key.
 * @returns An UpdatePayload object or `false` if no modifications are found.
 */
export const populateUpdatePayloadDiff = ({
  prev,
  next,
  exclude,
  parseMeta = false,
  metaProps,
  excludeNull = false,
  excludeBlanks = false,
  replaceAlias = false,
  boolProps,
  aliasMap,
  keepUnderModified = false,
  keepNested = false,
}: {
  prev: any;
  next: any;
  exclude?: string[];
  parseMeta?: boolean;
  metaProps?: string[];
  excludeNull?: boolean;
  excludeBlanks?: boolean;
  replaceAlias?: boolean;
  boolProps?: string[];
  aliasMap?: Record<string, string>;
  keepUnderModified?: boolean;
  keepNested?: boolean;
}): UpdatePayload | UpdateDestructedPayload | false => {
  if (parseMeta)
    parseMetaIfFound({ payloads: [next, prev], metaProps: metaProps });

  if (boolProps && Array.isArray(boolProps)) {
    for (const prop of boolProps) {
      if (next && prop in next) {
        next[prop] = !!next[prop];
      }
      if (prev && prop in next) {
        prev[prop] = !!prev[prop];
      }
    }
  }

  // if aliasMap is provided, map the alias
  if (aliasMap) {
    // avoid overwriting mapped props
    let mappedProps = new Set();
    next = fromEntries(
      Object.entries(next).map(([key, val]) => {
        if (key in aliasMap) {
          mappedProps.add(aliasMap[key]);
          return [aliasMap[key], val];
        } else if (mappedProps.has(key)) {
          return undefined;
        }
        return [key, val];
      }),
    );
    mappedProps = new Set();
    prev = fromEntries(
      Object.entries(prev).map(([key, val]) => {
        if (key in aliasMap) {
          mappedProps.add(aliasMap[key]);
          return [aliasMap[key], val];
        } else if (mappedProps.has(key)) {
          return undefined;
        }
        return [key, val];
      }),
    );
  }

  if (replaceAlias) {
    next = mapAlias(next);
    prev = mapAlias(prev);
  }

  let updatedProps = removeBlankPropsAndMask(
    diff(prev, next),
    exclude,
    !excludeNull,
    !excludeBlanks,
  );

  if (!Object.keys(updatedProps).length) return false;

  let prevState: Record<string, any>;
  if (keepNested) {
    prevState = extractPropsFromPrev(prev, updatedProps);
    updatedProps = extractPropsFromPrev(next, updatedProps);
  } else {
    prevState = diff(
      extractPropsFromPrev(next, updatedProps),
      extractPropsFromPrev(prev, updatedProps),
    ) as Record<string, unknown>;
  }

  return keepUnderModified
    ? {
        modifications: updatedProps,
        previous_state: prevState,
      }
    : {
        ...updatedProps,
        previous_state: prevState,
      };
};

const colAliasMap = {
  rqd: 'required',
  pk: 'primary_key',
  uidt: 'type',
  formula_raw: 'formula',
  title: 'field_titlt',
  id: 'field_id',
  cdf: 'default_value',
  qr_value_field_id: 'qr_value_field_id',
  fk_barcode_value_column_id: 'barcode_value_field_id',
  pv: 'display_value',
};

const ignorePropsInCol = [
  'validate',
  'un',
  'dtx',
  'dt',
  'validate',
  'dtxs',
  'altered',
  'custom',
  'cn',
  'cno',
  'nrqd',
  'unique',
  'au',
  'dtxp',
  'title',
  'column_name',
  'type',
  'userHasChangedTitle',
  'table_name',
  'view_id',
  'fk_model_id',
  'ai',
  'pk',
  'on_update',
  'on_delete',
  'virtual',
  'parsed_tree',
  'formula',
  'system',
  'order',
  'on_update',
  'on_delete',
  'onUpdate',
  'onDelete',
];

const excludeMetaColProps = ['defaultViewVolOrder'];
/**
 * Transforms an object's property names to snake_case.
 * Can optionally exclude specified properties from transformation.
 *
 * @param obj The object to transform.
 * @param excludedProps A list of property names to exclude from transformation.
 * @returns A new object with transformed property names.
 */
export const transformToSnakeCase = (obj: any, excludedProps?: string[]) => {
  if (!obj || typeof obj !== 'object') return obj;

  let entries = Object.entries(obj);

  if (excludedProps && Array.isArray(excludedProps)) {
    entries = entries.filter(([key]) => {
      return !excludedProps.includes(key);
    });
  }

  return fromEntries(
    entries.map(([key, val]) => {
      if (key in metaAliasMap) return [metaAliasMap[key], val];
      return [key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), val];
    }),
  );
};

/**
 * Filters and maps column properties to their aliases.
 * Excludes ignored properties and transforms property names where necessary.
 *
 * @param payload The object containing column properties.
 * @param excludedMetaProps A list of meta properties to exclude.
 * @returns A new object with filtered and aliased column properties.
 */
export const filterAndMapAliasToColProps = (
  payload: any,
  excludedMetaProps?: string[],
) => {
  if (!payload && typeof payload !== 'object') return payload;

  return fromEntries(
    Object.entries(payload)
      .filter(([key]) => {
        return !ignorePropsInCol.includes(key);
      })
      .map(([key, val]) => {
        let aliasKey: string;
        let formattedVal = val;

        if (key in colAliasMap) {
          aliasKey = colAliasMap[key];
        } else {
          aliasKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        }

        // convert to pascal case
        if (key === 'meta' && val && typeof val === 'object') {
          // remove excluded meta props
          if (val)
            val = fromEntries(
              Object.entries(val).filter(([k]) => {
                return (
                  !excludeMetaColProps.includes(k) &&
                  !['default_view_col_order', 'defaultViewColOrder'].includes(k)
                );
              }),
            );

          if (Object.keys(val).length === 0) {
            formattedVal = undefined;
          } else if (
            (payload.uidt || payload.field_type) === UITypes.Checkbox
          ) {
            const { icon, iconIdx, ...rest } = val as Record<string, any>;

            // extract option meta and include only label and color
            const checkboxMeta: Record<string, string> = rest;

            if (iconIdx) {
              checkboxMeta.icon = checkboxIconList[iconIdx]?.label;
            } else if (icon) {
              checkboxMeta.icon = checkboxIconList.find(
                (ic) => ic.checked === icon?.['checked'],
              )?.label;
            }

            return [aliasKey, checkboxMeta];
          } else if ((payload.uidt || payload.field_type) === UITypes.Rating) {
            const { icon, iconIdx, ...rest } = val as Record<string, any>;

            // extract option meta and include only label and color
            const ratingMeta: Record<string, string> = rest;

            if (iconIdx) {
              ratingMeta.icon = ratingIconList[iconIdx]?.label;
            } else if (icon) {
              ratingMeta.icon = ratingIconList.find(
                (ic) => ic.full === icon?.['full'],
              )?.label;
            }

            return [aliasKey, ratingMeta];
          } else {
            formattedVal = fromEntries(
              Object.entries(val).map(([k, v]) => {
                let aliasKey = k;
                let val = v;
                if (k in colAliasMap)
                  aliasKey = key.replace(
                    /[A-Z]/g,
                    (m) => `_${m.toLowerCase()}`,
                  );

                if (
                  payload.uidt === UITypes.Duration &&
                  k === 'duration_format'
                ) {
                  val = durationOptions[val]?.title;
                }
                return [aliasKey, val];
              }),
            );
          }

          return [
            aliasKey,
            transformToSnakeCase(formattedVal, excludedMetaProps),
          ];
        }

        if (
          key === 'options' &&
          [UITypes.MultiSelect, UITypes.SingleSelect].includes(payload.uidt)
        ) {
          formattedVal = (val as any[]).map((opt) => {
            return extractProps(opt, ['id', 'title', 'color', 'order']);
          });
        }

        return [aliasKey, formattedVal];
      }),
  );
};

export function remapWithAlias({ data, columns }) {
  const remapped = {};
  for (const [k, v] of Object.entries(data)) {
    const col = columns.find((c) => c.column_name === k || c.title === k);
    if (col) {
      remapped[col.title] = v;
    }
  }
  return remapped;
}

/**
 * Exclude unnecessary properties from the attachment object, like signed url, thumbnail url, base64, etc.
 *
 * @param obj The object to transform.
 */
export const excludeAttachmentProps = (obj: Record<string, unknown>) => {
  if (!obj || typeof obj !== 'object') return obj;

  return fromEntries(
    Object.entries(obj).filter(([key]) => {
      return !['data', 'signedPath', 'thumbnails'].includes(key);
    }),
  );
};

/**
 * Extracts certain props which store attachment and exclude unnecessary properties. It's an additional wrapper for excludeAttachmentProps function.
 *
 * @param obj The object to transform.
 * @param props The properties to transform.
 * @returns A new object with transformed property values.
 */
export const extractAttachmentPropsAndFormat = (
  obj: Record<string, unknown>,
  props: string[] = ['banner_image_url', 'logo_url'],
) => {
  if (!obj || typeof obj !== 'object') return obj;

  return fromEntries(
    Object.entries(obj).map(([key, val]) => {
      return [
        key,
        props.includes(key)
          ? excludeAttachmentProps(val as Record<string, unknown>)
          : val,
      ];
    }),
  );
};

export const extractColsMetaForAudit = (
  columns: ColumnType[],
  ...datas: Record<string, unknown>[]
) => {
  return columns
    .filter((col) => !isSystemColumn(col))
    .reduce((acc, col) => {
      if (
        !datas.length ||
        datas.some((data) => data[col.title] !== undefined)
      ) {
        acc[col.title] = extractColMetaForAudit(col, datas) as ColumnMeta;
      }
      return acc;
    }, {} as Record<string, ColumnMeta>);
};

export const extractExcludedColumnNames = (columns: ColumnType[]) => {
  return columns.reduce((colNames: string[], col) => {
    if (isSystemColumn(col) || isVirtualCol(col)) {
      colNames.push(col.title);
    }
    return colNames;
  }, [] as string[]);
};
