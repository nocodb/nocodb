import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import LongTextColumn from '~/models/LongTextColumn';

export default class AIColumn extends LongTextColumn {
  id: string;

  fk_integration_id: string;
  model: string;
  prompt: string;
  prompt_raw: string;
  error?: string;

  public static castType(data: AIColumn): AIColumn {
    return data && new AIColumn(data);
  }

  public static async insert(
    context: NcContext,
    aiColumn: Partial<AIColumn> & {
      fk_model_id: string;
      fk_column_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    return this._insert(
      context,
      aiColumn,
      ['fk_integration_id', 'model', 'prompt', 'prompt_raw', 'error'],
      ncMeta,
    );
  }

  public static async update(
    context: NcContext,
    columnId: string,
    aiColumn: Partial<AIColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    return this._update(
      context,
      columnId,
      aiColumn,
      ['fk_integration_id', 'model', 'prompt', 'prompt_raw', 'error'],
      ncMeta,
    );
  }
}
