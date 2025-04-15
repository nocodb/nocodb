import { ColumnType, LinkToAnotherRecordType, LookupType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ncIsArray } from '~/lib/is';
import { ColumnHelper } from '../column-helper';
import { ComputedTypePasteError } from '~/lib/error';

export class LookupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): null {
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

    const colOptions = col.colOptions as LookupType;
    const relationColumnOptions = colOptions.fk_relation_column_id
      ? (meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
          ?.colOptions as LinkToAnotherRecordType)
      : null;
    const relatedTableMeta =
      relationColumnOptions?.fk_related_model_id &&
      metas?.[relationColumnOptions.fk_related_model_id as string];

    const childColumn = relatedTableMeta?.columns.find(
      (c: ColumnType) => c.id === colOptions.fk_lookup_column_id
    ) as ColumnType | undefined;

    if (!childColumn) return value;

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
