import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { isBt, isHm, isMm, isOo } from '../../utils';
import { DefaultColumnHelper } from '../DefaultColumnHelper';
import { BelongsToHelper } from './BelongsTo';
import { HasManyHelper } from './HasMany';
import { ManyToManyHelper } from './ManyToMany';
import { OneToOneHelper } from './OneToOne';

export class LTARHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  getLtarHelperColumn(
    params: SerializerOrParserFnProps['params']
  ): AbstractColumnHelper {
    let columnHelper: new () => AbstractColumnHelper = DefaultColumnHelper;

    if (isHm(params.col)) columnHelper = HasManyHelper;
    if (isMm(params.col)) columnHelper = ManyToManyHelper;
    if (isBt(params.col)) columnHelper = BelongsToHelper;
    if (isOo(params.col)) columnHelper = OneToOneHelper;

    return new columnHelper();
  }

  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    return this.getLtarHelperColumn(params).serializeValue(value, params);
  }

  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    return this.getLtarHelperColumn(params).parseValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.getLtarHelperColumn(params).parsePlainCellValue(value, params);
  }
}

export { BelongsToHelper, HasManyHelper, ManyToManyHelper, OneToOneHelper };
