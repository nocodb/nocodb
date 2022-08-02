import { expect } from 'chai';
import ApiToken from '../../../../lib/models/ApiToken';
import knex from 'knex';
import { MetaTable } from '../../../../lib/utils/globals';
import sinon from 'sinon';
import NcMetaIO from '../../../../lib/meta/NcMetaIO';
import XcMigrationSource from '../../../../lib/migrations/XcMigrationSource';
import XcMigrationSourcev2 from '../../../../lib/migrations/XcMigrationSourcev2';

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
});

describe('ApiToken', () => {
  const mockNcMeta = sinon.mock(NcMetaIO);
  mockNcMeta.metaList = async (
    _project_id: string,
    _dbAlias: string,
    target: string,
    args?: {
      condition?: { [key: string]: any };
    }
  ) => {
    return await qb(target)
      .select()
      .where(args?.condition || {});
  };
  mockNcMeta.metaInsert = async (
    _project_id: string,
    _dbAlias: string,
    target: string,
    data: any
  ) => {
    return await qb(target).insert(data);
  };
  mockNcMeta.metaGet = async (
    _project_id: string,
    _base_id: string,
    target: string,
    idOrCondition: string | { [key: string]: any }
  ) => {
    return await qb(target).select().where(idOrCondition).first();
  };
  mockNcMeta.metaDelete = async (
    _project_id: string,
    _dbAlias: string,
    target: string,
    idOrCondition?: string | { [key: string]: any }
  ) => {
    return await qb(target).where(idOrCondition).delete();
  };
  const ownerToken = {
    created_at: '',
    db_alias: '',
    description: 'test_token_1',
    enabled: 1,
    expiry: '',
    id: 1,
    permissions: '',
    project_id: '',
    token: 'test_token_1',
    updated_at: '',
    user_id: 'owner1',
  };
  const userToken = {
    description: 'test_token_2',
    user_id: 'user1',
    token: 'test_token_2',
    created_at: '',
    db_alias: '',
    enabled: 1,
    expiry: '',
    id: 2,
    permissions: '',
    project_id: '',
    updated_at: '',
  };

  const testTokens = [ownerToken, userToken];

  beforeEach(async () => {
    await qb(MetaTable.API_TOKENS).insert(testTokens);
  });

  afterEach(async () => {
    await qb(MetaTable.API_TOKENS).delete();
  });

  describe('list', () => {
    describe('when user is creator or owner', () => {
      it('should return all tokens', async () => {
        const userId = 'owner1';
        const userRoles = { creator: true, owner: true };
        const tokens = await ApiToken.list(userId, userRoles, mockNcMeta);
        expect(tokens).to.eql(testTokens);
      });
    });

    describe('when user is not creator or owner', () => {
      it('should return user tokens', async () => {
        const userId = 'user1';
        const userRoles = { creator: false, owner: false };
        const tokens = await ApiToken.list(userId, userRoles, mockNcMeta);
        expect(tokens).to.eql([userToken]);
      });
    });
  });

  describe('insert', () => {
    it('should insert token and return created token', async () => {
      const token = await ApiToken.insert(
        {
          description: 'insert_test_token_3',
          user_id: 'user2',
        },
        mockNcMeta
      );
      expect(token).to.have.property('description', 'insert_test_token_3');
    });
  });

  describe('delete', () => {
    describe('when user is creator or owner', () => {
      const userId = 'owner1';
      const userRoles = { creator: true, owner: true };
      it('can delete own token', async () => {
        const deleted = await ApiToken.delete(
          ownerToken.token,
          userId,
          userRoles,
          mockNcMeta
        );
        expect(deleted).to.equal(1);
      });

      it('can delete other user token', async () => {
        const deleted = await ApiToken.delete(
          userToken.token,
          userId,
          userRoles,
          mockNcMeta
        );
        expect(deleted).to.equal(1);
      });
    });

    describe('when user is not creator or owner', () => {
      const userId = 'user1';
      const userRoles = { creator: false, owner: false };
      it('can delete own token', async () => {
        const deleted = await ApiToken.delete(
          userToken.token,
          userId,
          userRoles,
          mockNcMeta
        );
        expect(deleted).to.equal(1);
      });

      it('can not delete other user token', async () => {
        const deleted = await ApiToken.delete(
          ownerToken.token,
          userId,
          userRoles,
          mockNcMeta
        );
        expect(deleted).to.equal(0);
      });
    });
  });

  describe('getByToken', () => {
    it('should return token', async () => {
      const token = await ApiToken.getByToken(userToken.token, mockNcMeta);
      expect(token).to.eql(userToken);
    });
  });
});
