import { ColumnType, TableType, UserType } from '../Api';

export default abstract class AbstractColumnHelper {
  public columnDefaultMeta?: Record<string, any> = {};
  public abstract serializeValue(
    value: SerializerOrParserFnProps['value'],
    params: SerializerOrParserFnProps['params']
  ): any;
  public abstract parseValue(
    value: SerializerOrParserFnProps['value'],
    params: SerializerOrParserFnProps['params']
  ): any;
  public abstract parsePlainCellValue(
    value: SerializerOrParserFnProps['value'],
    params: SerializerOrParserFnProps['params']
  ): string;
}

export interface SerializerOrParserFnProps {
  value: any;
  params: {
    col: ColumnType;
    abstractType?: unknown;
    meta?: TableType;
    metas?: { [idOrTitle: string]: TableType | any };
    baseUsers?: Map<string, UserType[]>;
    isMysql?: (sourceId: string) => boolean;
    isMssql?: (sourceId: string) => boolean;
    isXcdbBase?: (sourceId: string) => boolean;
    isPg?: (sourceId: string) => boolean;
    isUnderLookup?: boolean;
    rowId?: string | null;
    isMultipleCellPaste?: boolean;
  };
}
