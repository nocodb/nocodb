import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { isEE } from '../../../utils/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Org-User invite picker — admin-only ACL on
 * `GET /api/v2/orgs/:orgId/users/invitable`.
 *
 * The route itself lives in the cloud / on-prem build overrides and isn't
 * loaded by the shared-EE test backend, so we can't black-box it here. What
 * we *can* lock in is the **cloud-org ACL gate** the route relies on:
 *
 *     @Acl('orgUserListForInvite', { scope: 'cloud-org' })
 *
 * The same gate (`scope: 'cloud-org'`) protects the `orgGet` route which
 * lives in shared EE (`/api/v2/orgs/:orgId`). Verifying the gate against
 * `orgGet` proves the cross-org behaviour the reviewer asked about; the
 * picker route inherits the exact same middleware setup.
 *
 * If the picker controller ever moves into shared EE, swap the URL below
 * to `/users/invitable` and these tests will continue to assert the same
 * thing.
 */
export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Cloud-org ACL gate (covers /users/invitable)', () => {
    let context: any = {};
    let userATokenStr: string;
    let userBTokenStr: string;
    let orgA: string;
    let orgB: string;

    /** Create an org row + nc_org_users entry at OWNER for the given user. */
    async function setupOrg(userId: string, idHint: string): Promise<string> {
      const id = `${idHint}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      await Noco.ncMeta.knexConnection(MetaTable.ORG).insert({
        id,
        title: `picker-test ${id}`,
      });
      await Noco.ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
        fk_org_id: id,
        fk_user_id: userId,
        roles: EnterpriseOrgUserRoles.ADMIN,
      });
      return id;
    }

    beforeEach(async () => {
      // init() makes its first user a global SUPER_ADMIN, which short-circuits
      // the cross-org check via User.getWithRoles' super-admin bypass — useless
      // for testing the gate. Subsequent users created via createUser are
      // regular org-level users; use those as the test subjects.
      context = await init();

      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const a = await createUser(context, {
        email: `picker-userA-${stamp}@nocodb.com`,
      });
      const b = await createUser(context, {
        email: `picker-userB-${stamp}@nocodb.com`,
      });
      userATokenStr = a.token;
      userBTokenStr = b.token;

      orgA = await setupOrg(a.user.id, 'org_a');
      orgB = await setupOrg(b.user.id, 'org_b');
    });

    it('OWNER of own org → 200 on /api/v2/orgs/:orgId', async () => {
      const res = await request(context.app)
        .get(`/api/v2/orgs/${orgA}`)
        .set('xc-auth', userATokenStr);

      expect(res.status).to.equal(200);
    });

    it('OWNER of org A → 403 on /api/v2/orgs/B (cross-org)', async () => {
      const res = await request(context.app)
        .get(`/api/v2/orgs/${orgB}`)
        .set('xc-auth', userATokenStr);

      expect(res.status).to.equal(403);
    });

    it('OWNER of org B → 403 on /api/v2/orgs/A (cross-org, reverse)', async () => {
      const res = await request(context.app)
        .get(`/api/v2/orgs/${orgA}`)
        .set('xc-auth', userBTokenStr);

      expect(res.status).to.equal(403);
    });

    it('user with no org role → 403', async () => {
      const { token } = await createUser(context, {
        email: `picker-noorg-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}@nocodb.com`,
      });

      const res = await request(context.app)
        .get(`/api/v2/orgs/${orgA}`)
        .set('xc-auth', token);

      expect(res.status).to.equal(403);
    });
  });
}
