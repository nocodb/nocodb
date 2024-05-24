import { MetaService as MetaServiceCE } from 'src/meta/meta.service';
import { Injectable, Optional } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import XcMigrationSourcev3 from '~/meta/migrations/XcMigrationSourcev3';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable } from '~/utils/globals';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const nanoidWorkspace = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

@Injectable()
export class MetaService extends MetaServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    await super.init();
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourcev3(),
      tableName: 'xc_knex_migrationsv3',
    });
    return true;
  }

  /***
   * Generate nanoid for the given target
   * @param target - Table name
   * @returns {string} - Generated nanoid
   * */
  public async genNanoid(target: string) {
    const prefixMap: { [key: string]: string } = {
      [MetaTable.PROJECT]: 'p',
      [MetaTable.BASES]: 'b',
      [MetaTable.MODELS]: 'm',
      [MetaTable.COLUMNS]: 'c',
      [MetaTable.COL_RELATIONS]: 'l',
      [MetaTable.COL_SELECT_OPTIONS]: 's',
      [MetaTable.COL_LOOKUP]: 'lk',
      [MetaTable.COL_ROLLUP]: 'rl',
      [MetaTable.COL_FORMULA]: 'f',
      [MetaTable.FILTER_EXP]: 'fi',
      [MetaTable.SORT]: 'so',
      [MetaTable.SHARED_VIEWS]: 'sv',
      [MetaTable.ACL]: 'ac',
      [MetaTable.FORM_VIEW]: 'fv',
      [MetaTable.FORM_VIEW_COLUMNS]: 'fvc',
      [MetaTable.GALLERY_VIEW]: 'gv',
      [MetaTable.GALLERY_VIEW_COLUMNS]: 'gvc',
      [MetaTable.KANBAN_VIEW]: 'kv',
      [MetaTable.KANBAN_VIEW_COLUMNS]: 'kvc',
      [MetaTable.CALENDAR_VIEW]: 'cv',
      [MetaTable.CALENDAR_VIEW_COLUMNS]: 'cvc',
      [MetaTable.CALENDAR_VIEW_RANGE]: 'cvr',
      [MetaTable.USERS]: 'us',
      [MetaTable.TEAMS]: 'tm',
      [MetaTable.VIEWS]: 'vw',
      [MetaTable.HOOKS]: 'hk',
      [MetaTable.HOOK_LOGS]: 'hkl',
      [MetaTable.AUDIT]: 'adt',
      [MetaTable.API_TOKENS]: 'tkn',
      [MetaTable.WORKSPACE]: 'w',
      [MetaTable.COWRITER]: 'cw',
      [MetaTable.SSO_CLIENT]: 'sso',
      [MetaTable.ORG]: 'o',
      [MetaTable.EXTENSIONS]: 'ext',
      [MetaTable.COMMENTS]: 'com',
      [MetaTable.COMMENTS_REACTIONS]: 'cre',
      [MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE]: 'cnp',
    };

    const prefix = prefixMap[target] || 'nc';
    let id: string;

    do {
      // using nanoid to avoid collision with existing ids when duplicating
      id = `${prefix}${
        target === MetaTable.WORKSPACE ? nanoidWorkspace() : nanoidv2()
      }`;
      // re-generate id if already in use
    } while (await this.knex(target).where({ id }).first());

    return id;
  }
}

export * from 'src/meta/meta.service';
