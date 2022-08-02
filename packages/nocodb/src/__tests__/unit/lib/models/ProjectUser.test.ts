import { expect } from 'chai';
import ProjectUser from '../../../../lib/models/ProjectUser';
import sinon from 'sinon';
import NcMetaIO from '../../../../lib/meta/NcMetaIO';
import knex from 'knex';
import XcMigrationSourcev2 from '../../../../lib/migrations/XcMigrationSourcev2';
import { MetaTable } from '../../../../lib/utils/globals';
import XcMigrationSource from '../../../../lib/migrations/XcMigrationSource';

const qb = knex({
  client: 'sqlite3',
  connection: {
    filename: ':memory:',
  },
  useNullAsDefault: true,
});

before(async () => {
  await qb.migrate.latest({
    migrationSource: new XcMigrationSource(),
    tableName: 'xc_knex_migrations',
  });
  await qb.migrate.latest({
    migrationSource: new XcMigrationSourcev2(),
    tableName: 'xc_knex_migrationsv2',
  });
  const addMockData = async () => {
    await qb(MetaTable.USERS).insert([
      {
        id: '1',
        email: 'test@email.com',
        invite_token: 'test_invite_token',
        roles: 'owner',
      },
      {
        id: '2',
        email: 'test2@email.com',
        invite_token: 'test_invite_token2',
        roles: 'owner',
      },
    ]);

    await qb(MetaTable.PROJECT_USERS).insert([
      {
        fk_user_id: '1',
        project_id: '1',
        roles: 'owner',
      },
      {
        fk_user_id: '2',
        project_id: '1',
        roles: 'owner',
      },
    ]);
  };
  await addMockData();
});

describe('ProjectUser', () => {
  const mockNcMeta = sinon.mock(NcMetaIO);
  mockNcMeta.knex = qb;

  describe('getOwnersList', () => {
    it('should return owners list', async () => {
      const ownersList = await ProjectUser.getOwnersList(
        { project_id: '1' },
        mockNcMeta
      );
      expect(ownersList).eql([
        {
          id: '1',
          email: 'test@email.com',
          invite_token: 'test_invite_token',
          main_roles: 'owner',
          project_id: '1',
          roles: 'owner',
        },
        {
          email: 'test2@email.com',
          id: '2',
          invite_token: 'test_invite_token2',
          main_roles: 'owner',
          project_id: '1',
          roles: 'owner',
        },
      ]);
    });
  });

  describe('getOwnersEmailsCSV', () => {
    it('should return owners emails csv', async () => {
      const ownersEmailsCSV = await ProjectUser.getOwnersEmailsCSV(
        '1',
        mockNcMeta
      );
      expect(ownersEmailsCSV).eql('test@email.com,test2@email.com');
    });
  });
});
