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

  public async genNanoid(target: string) {
    let prefix;
    switch (target) {
      case MetaTable.PROJECT:
        prefix = 'p';
        break;
      case MetaTable.BASES:
        prefix = 'b';
        break;
      case MetaTable.MODELS:
        prefix = 'm';
        break;
      case MetaTable.COLUMNS:
        prefix = 'c';
        break;
      case MetaTable.COL_RELATIONS:
        prefix = 'l';
        break;
      case MetaTable.COL_SELECT_OPTIONS:
        prefix = 's';
        break;
      case MetaTable.COL_LOOKUP:
        prefix = 'lk';
        break;
      case MetaTable.COL_ROLLUP:
        prefix = 'rl';
        break;
      case MetaTable.COL_FORMULA:
        prefix = 'f';
        break;
      case MetaTable.FILTER_EXP:
        prefix = 'fi';
        break;
      case MetaTable.SORT:
        prefix = 'so';
        break;
      case MetaTable.SHARED_VIEWS:
        prefix = 'sv';
        break;
      case MetaTable.ACL:
        prefix = 'ac';
        break;
      case MetaTable.FORM_VIEW:
        prefix = 'fv';
        break;
      case MetaTable.FORM_VIEW_COLUMNS:
        prefix = 'fvc';
        break;
      case MetaTable.GALLERY_VIEW:
        prefix = 'gv';
        break;
      case MetaTable.GALLERY_VIEW_COLUMNS:
        prefix = 'gvc';
        break;
      case MetaTable.KANBAN_VIEW:
        prefix = 'kv';
        break;
      case MetaTable.KANBAN_VIEW_COLUMNS:
        prefix = 'kvc';
        break;
      case MetaTable.USERS:
        prefix = 'us';
        break;
      case MetaTable.ORGS:
        prefix = 'org';
        break;
      case MetaTable.TEAMS:
        prefix = 'tm';
        break;
      case MetaTable.VIEWS:
        prefix = 'vw';
        break;
      case MetaTable.HOOKS:
        prefix = 'hk';
        break;
      case MetaTable.HOOK_LOGS:
        prefix = 'hkl';
        break;
      case MetaTable.AUDIT:
        prefix = 'adt';
        break;
      case MetaTable.API_TOKENS:
        prefix = 'tkn';
        break;
      case MetaTable.WORKSPACE:
        prefix = 'w';
        break;
      case MetaTable.COWRITER:
        prefix = 'cw';
        break;
      default:
        prefix = 'nc';
        break;
    }
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
