import { extractProps } from '../meta/helpers/extractProps';
import Noco from '../Noco';
import { MetaTable } from '../utils/globals';

import type { CowriterType } from 'nocodb-sdk';

export default class Cowriter implements CowriterType {
  id?: string;
  fk_model_id?: string;
  prompt_statement?: string;
  prompt_statement_template?: string;
  output?: string;
  meta?: string | Record<string, any>;
  is_read?: boolean;
  created_by?: string;

  constructor(cowriter: Cowriter | CowriterType) {
    Object.assign(this, cowriter);
  }

  public static async get(cowriterId: string, ncMeta = Noco.ncMeta) {
    const cowriter = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.COWRITER,
      cowriterId
    );
    return cowriter && new Cowriter(cowriter);
  }

  public static async insert(
    cowriter: Partial<Cowriter>,
    ncMeta = Noco.ncMeta
  ) {
    // extract props which is allowed to be inserted
    const insertObject = extractProps(cowriter, [
      'id',
      'fk_model_id',
      'prompt_statement',
      'prompt_statement_template',
      'output',
      'meta',
      'is_read',
      'created_by',
    ]);

    // stringify meta if it is an object
    if ('meta' in insertObject && typeof insertObject.meta === 'object') {
      insertObject.meta = JSON.stringify(insertObject.meta);
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.COWRITER,
      insertObject
    );
    return this.get(id);
  }

  static async update(
    cowriterId: string,
    cowriterObj: Partial<CowriterType>,
    ncMeta = Noco.ncMeta
  ) {
    const updateObject = extractProps(cowriterObj, ['meta', 'is_read']);

    // stringify meta if it is an object
    if ('meta' in updateObject && typeof updateObject.meta === 'object') {
      updateObject.meta = JSON.stringify(updateObject.meta);
    }

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COWRITER,
      updateObject,
      cowriterId
    );
  }

  static async list(
    {
      fk_model_id,
    }: {
      fk_model_id: string;
    },
    ncMeta = Noco.ncMeta
  ) {
    const cowriterList = await ncMeta.metaList2(
      null,
      null,
      MetaTable.COWRITER,
      {
        condition: {
          fk_model_id,
        },
        orderBy: {
          created_at: 'desc',
        },
      }
    );

    return Promise.all(
      cowriterList.map(async (cowriter) => {
        return new Cowriter(cowriter);
      })
    );
  }
}
