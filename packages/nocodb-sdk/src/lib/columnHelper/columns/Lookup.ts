import { ColumnType, LinkToAnotherRecordType, LookupType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ncIsArray } from '~/lib/is';
import { ColumnHelper } from '../column-helper';
import { ComputedTypePasteError } from '~/lib/error';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';
import { getEffectiveLookupColumn } from '../utils/get-lookup-result-type';
import { parseProp } from '~/lib/helperFunctions';
import rfdc from 'rfdc';

const clone = rfdc();

export class LookupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (params.serializeSearchQuery) {
      if (!value) return null;

      // Get the child column being looked up
      const { col, meta, metas } = params;
      const baseId = meta?.base_id;
      const colOptions = col.colOptions as LookupType;
      const relationColumnOptions = colOptions.fk_relation_column_id
        ? (meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
            ?.colOptions as LinkToAnotherRecordType)
        : null;
      const relatedBaseId = relationColumnOptions?.fk_related_base_id || baseId;
      const relatedTableMeta =
        relationColumnOptions?.fk_related_model_id &&
        getMetaWithCompositeKey(
          metas,
          relatedBaseId,
          relationColumnOptions.fk_related_model_id as string
        );

      let childColumn = relatedTableMeta?.columns.find(
        (c: ColumnType) => c.id === colOptions.fk_lookup_column_id
      ) as ColumnType | undefined;

      if (!childColumn) return value;

      childColumn = clone(childColumn);

      // Use serializeValue on child column to get raw search value
      if (ncIsArray(value)) {
        return value
          .map((v) => {
            return ColumnHelper.serializeValue(v, {
              ...params,
              col: childColumn!,
            });
          })
          .join(', ');
      }

      return ColumnHelper.serializeValue(value, {
        ...params,
        col: childColumn!,
      });
    }

    if (params.isMultipleCellPaste) {
      return undefined;
    } else {
      throw new ComputedTypePasteError();
    }
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (!value) return null;

    const { col, meta, metas } = params;

    const baseId = meta?.base_id;
    const colOptions = col.colOptions as LookupType;
    // For a Lookup column, resolve the underlying relation column's options.
    // For a direct LinkToAnotherRecord column there is no fk_relation_column_id,
    // so the column's own colOptions already are the relation options.
    const relationColumnOptions = (
      colOptions.fk_relation_column_id
        ? meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
            ?.colOptions
        : col.colOptions
    ) as LinkToAnotherRecordType | undefined;

    const relatedBaseId = relationColumnOptions?.fk_related_base_id || baseId;
    const relatedTableMeta = relationColumnOptions?.fk_related_model_id
      ? getMetaWithCompositeKey(
          metas,
          relatedBaseId,
          relationColumnOptions.fk_related_model_id as string
        )
      : undefined;

    // Display column priority:
    //   1. Lookup's explicit target column (fk_lookup_column_id)
    //   2. LTAR's custom display-value override (fk_display_value_column_id)
    //   3. Related table's primary value column (default)
    const displayColumnId =
      colOptions.fk_lookup_column_id ??
      relationColumnOptions?.fk_display_value_column_id ??
      relatedTableMeta?.columns?.find((c: ColumnType) => c.pv)?.id;

    let childColumn = relatedTableMeta?.columns?.find(
      (c: ColumnType) => c.id === displayColumnId
    ) as ColumnType | undefined;

    // No resolvable display column (e.g. external base / nested links). Never
    // return a raw object — it would stringify as "[object Object]".
    if (!childColumn) {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object') return '';
      return value?.toString() ?? '';
    }

    childColumn = clone(childColumn);

    // Apply the lookup column's own formatting override (meta.display_type +
    // meta.display_column_meta) when set AND still valid for the child's current
    // result type; otherwise the resolved child column is returned unchanged so its
    // native formatting is inherited (guards against a stale override after the
    // looked-up field's type changes).
    childColumn = getEffectiveLookupColumn(parseProp(col?.meta), childColumn);

    // A linked-record value arrives as a record object keyed by the related
    // table's column titles/ids — extract the display column's field before
    // recursing. A complex cell value (e.g. a Lookup of a User column, whose
    // value is a user object with neither key) falls through to the raw value
    // so the recursive parser can handle it.
    const resolveRecordValue = (v: any) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? v[childColumn!.title] ?? v[childColumn!.id] ?? v
        : v;

    if (ncIsArray(value)) {
      return value
        .map((v) =>
          ColumnHelper.parseValue(resolveRecordValue(v), {
            ...params,
            col: childColumn!,
          })
        )
        .join(', ');
    }

    return ColumnHelper.parseValue(resolveRecordValue(value), {
      ...params,
      col: childColumn!,
    });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
