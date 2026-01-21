import { ColumnType, LinkToAnotherRecordType, LookupType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ncIsArray } from '~/lib/is';
import { ColumnHelper } from '../column-helper';
import { ComputedTypePasteError } from '~/lib/error';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';
import rfdc from 'rfdc';

const clone = rfdc();

export class LookupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (params.serializeSearchQuery) {
      return this.parseValue(value, params);
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

    if (ncIsArray(value)) {
      return value
        .map((v) => {
          return ColumnHelper.parseValue(v, { ...params, col: childColumn! });
        })
        .join(', ');
    }

    return ColumnHelper.parseValue(value, { ...params, col: childColumn! });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
