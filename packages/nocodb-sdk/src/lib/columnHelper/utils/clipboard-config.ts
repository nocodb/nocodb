import { ColumnType } from '~/lib/Api';
import { extractProps } from '~/lib/commonUtils';
import { parseProp } from '~/lib/helperFunctions';

export const getClipboardConfigForColumn = ({
  col,

  extractMetaProps = [],
}: {
  col: ColumnType;
  extractMetaProps?: string[];
}): {
  column: Partial<ColumnType>;
} => {
  const columnMeta = extractMetaProps.length
    ? extractProps(parseProp(col.meta), extractMetaProps)
    : parseProp(col.meta);

  return {
    column: col
      ? {
          id: col.id,
          title: col.title,
          column_name: col.column_name,
          meta: columnMeta,
          colOptions: col.colOptions,
          uidt: col.uidt,
          cdf: col.cdf,
          description: col.description,
          source_id: col.source_id,
          fk_model_id: col.fk_model_id,
          system: col.system,
        }
      : {},
  };
};
