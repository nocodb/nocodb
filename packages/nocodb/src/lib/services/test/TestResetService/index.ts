import Noco from '../../../Noco';

import Knex from 'knex';
import NocoCache from '../../../cache/NocoCache';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import createProjects from './createProjects';
import { isPgSakilaToBeReset, resetPgSakila } from './resetPgSakila';
import createUser from './createUser';
import resetMeta from './resetMeta';

export class TestResetService {
  private knex: Knex | null = null;

  constructor() {
    this.knex = Noco.ncMeta.knex;
  }

  async process() {
    try {
      await NcConnectionMgrv2.destroyAll();

      if (await isPgSakilaToBeReset()) {
        await resetPgSakila();
      }

      await resetMeta(this.knex);

      await NocoCache.destroy();

      const { token } = await createUser();
      const projects = await createProjects(token);

      return { token, projects };
    } catch (e) {
      console.error('cleanupMeta', e);
      return { error: e };
    }
  }
}
