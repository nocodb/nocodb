import 'mocha';
import { expect } from 'chai';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { isEE } from '../../../utils/helpers';
import { OrgUsersService as CloudOrgUsersService } from 'src/ee-cloud/services/org-users.service';
import { OrgUsersService as OnPremOrgUsersService } from 'src/ee-on-prem/services/org-users.service';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * OrgUsersService — admin-role safeguards.
 *
 * Two backstops we want to lock in for both cloud and on-prem:
 *
 *  1. Assigning the ADMIN role at the service layer requires the requester
 *     to themselves be an org admin (super admin on on-prem). ACL already
 *     gates the endpoint; this is defense in depth.
 *  2. The only ADMIN cannot be removed or demoted.
 *
 * Both services live under build-specific overlays (ee-cloud / ee-on-prem)
 * that the shared-EE test backend doesn't load via HTTP, so we instantiate
 * each service with bare stubs and call methods directly.
 */
export default function () {
  if (!isEE()) {
    return true;
  }

  describe('OrgUsersService — admin-role safeguards', () => {
    let context: any;
    let cloudService: CloudOrgUsersService;
    let onPremService: OnPremOrgUsersService;
    let orgId: string;
    let adminUserId: string;
    let creatorUserId: string;
    let outsiderUserId: string;
    let targetUserId: string;
    let targetEmail: string;

    const seedOrgUser = (userId: string, role: string) =>
      Noco.ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .insert({ fk_org_id: orgId, fk_user_id: userId, roles: role });

    const fetchOrgUser = (userId: string) =>
      Noco.ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .where({ fk_org_id: orgId, fk_user_id: userId })
        .first();

    async function expectForbidden(p: Promise<unknown>) {
      try {
        await p;
        expect.fail('expected service to reject with a forbidden error');
      } catch (e: any) {
        const msg = e?.message || String(e);
        expect(msg, `unexpected error: ${msg}`).to.match(/Only org admins/i);
      }
    }

    async function expectBadRequest(
      p: Promise<unknown>,
      pattern: RegExp,
    ) {
      try {
        await p;
        expect.fail('expected service to reject');
      } catch (e: any) {
        const msg = e?.message || String(e);
        expect(msg, `unexpected error: ${msg}`).to.match(pattern);
      }
    }

    beforeEach(async () => {
      context = await init();

      const noopHooks = { emit: () => {} } as any;
      const noopPayment = { reseatSubscription: async () => {} } as any;
      cloudService = new CloudOrgUsersService(noopHooks, noopPayment);
      onPremService = new OnPremOrgUsersService(
        {} as any,
        noopHooks,
        {} as any,
        noopPayment,
      );

      const stamp = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      orgId = `oarole_${stamp}`;
      await Noco.ncMeta
        .knexConnection(MetaTable.ORG)
        .insert({ id: orgId, title: `role-safeguard-test ${stamp}` });

      const admin = await createUser(context, {
        email: `admin-${stamp}@nocodb.com`,
      });
      const creator = await createUser(context, {
        email: `creator-${stamp}@nocodb.com`,
      });
      const outsider = await createUser(context, {
        email: `outsider-${stamp}@nocodb.com`,
      });
      targetEmail = `target-${stamp}@nocodb.com`;
      const target = await createUser(context, { email: targetEmail });
      adminUserId = admin.user.id;
      creatorUserId = creator.user.id;
      outsiderUserId = outsider.user.id;
      targetUserId = target.user.id;

      await seedOrgUser(adminUserId, EnterpriseOrgUserRoles.ADMIN);
      await seedOrgUser(creatorUserId, EnterpriseOrgUserRoles.CREATOR);
      // outsider intentionally not added to the org
    });

    describe('cloud OrgUsersService', () => {
      it('rejects a non-admin requester adding a user as ADMIN', async () => {
        await expectForbidden(
          cloudService.addUserToOrg({
            orgId,
            userId: targetUserId,
            userProps: { roles: EnterpriseOrgUserRoles.ADMIN } as any,
            req: { user: { id: creatorUserId } } as any,
          }),
        );

        // sanity: target was not inserted into the org
        expect(await fetchOrgUser(targetUserId)).to.equal(undefined);
      });

      it('rejects an outsider (not in the org) adding a user as ADMIN', async () => {
        await expectForbidden(
          cloudService.addUserToOrg({
            orgId,
            userId: targetUserId,
            userProps: { roles: EnterpriseOrgUserRoles.ADMIN } as any,
            req: { user: { id: outsiderUserId } } as any,
          }),
        );
      });

      it('lets an admin requester add a user as ADMIN', async () => {
        await cloudService.addUserToOrg({
          orgId,
          userId: targetUserId,
          userProps: { roles: EnterpriseOrgUserRoles.ADMIN } as any,
          req: { user: { id: adminUserId } } as any,
        });

        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('non-admin requester cannot promote a member to ADMIN', async () => {
        await seedOrgUser(targetUserId, EnterpriseOrgUserRoles.CREATOR);

        await expectForbidden(
          cloudService.updateUserRoleInOrg({
            orgId,
            userId: targetUserId,
            orgRole: EnterpriseOrgUserRoles.ADMIN,
            req: { user: { id: creatorUserId } } as any,
          }),
        );

        // role unchanged
        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.CREATOR);
      });

      it('admin requester can promote a member to ADMIN', async () => {
        await seedOrgUser(targetUserId, EnterpriseOrgUserRoles.CREATOR);

        await cloudService.updateUserRoleInOrg({
          orgId,
          userId: targetUserId,
          orgRole: EnterpriseOrgUserRoles.ADMIN,
          req: { user: { id: adminUserId } } as any,
        });

        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('blocks demoting the only admin', async () => {
        await expectBadRequest(
          cloudService.updateUserRoleInOrg({
            orgId,
            userId: adminUserId,
            orgRole: EnterpriseOrgUserRoles.CREATOR,
            req: { user: { id: adminUserId } } as any,
          }),
          /last org admin/i,
        );

        const row = await fetchOrgUser(adminUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('blocks removing the only admin', async () => {
        await expectBadRequest(
          cloudService.removeUserFromOrg({
            orgId,
            userId: adminUserId,
            req: { user: { id: adminUserId } } as any,
          }),
          /last org admin/i,
        );

        // not soft-deleted
        const row = await fetchOrgUser(adminUserId);
        expect(row?.deleted).to.not.equal(true);
      });

      it('allows demoting one admin when another admin exists', async () => {
        // promote target so we have two admins
        await seedOrgUser(targetUserId, EnterpriseOrgUserRoles.ADMIN);

        await cloudService.updateUserRoleInOrg({
          orgId,
          userId: adminUserId,
          orgRole: EnterpriseOrgUserRoles.CREATOR,
          req: { user: { id: targetUserId } } as any,
        });

        const row = await fetchOrgUser(adminUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.CREATOR);
      });
    });

    describe('on-prem OrgUsersService', () => {
      // On-prem service derives its org id from Noco.ncDefaultOrgId — point it
      // at our seeded org for the duration of the suite.
      let originalDefaultOrgId: any;

      beforeEach(() => {
        originalDefaultOrgId = (Noco as any).ncDefaultOrgId;
        (Noco as any).ncDefaultOrgId = orgId;
      });

      afterEach(() => {
        (Noco as any).ncDefaultOrgId = originalDefaultOrgId;
      });

      it('non-admin requester cannot promote a member to ADMIN', async () => {
        await seedOrgUser(targetUserId, EnterpriseOrgUserRoles.CREATOR);

        await expectForbidden(
          onPremService.updateOrgRole({
            userId: targetUserId,
            orgRole: EnterpriseOrgUserRoles.ADMIN,
            req: { user: { id: creatorUserId } } as any,
          }),
        );

        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.CREATOR);
      });

      it('admin requester can promote a member to ADMIN', async () => {
        await seedOrgUser(targetUserId, EnterpriseOrgUserRoles.CREATOR);

        await onPremService.updateOrgRole({
          userId: targetUserId,
          orgRole: EnterpriseOrgUserRoles.ADMIN,
          req: { user: { id: adminUserId } } as any,
        });

        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('super-admin bypasses the admin-only check even without an org row', async () => {
        await seedOrgUser(targetUserId, EnterpriseOrgUserRoles.CREATOR);

        await onPremService.updateOrgRole({
          userId: targetUserId,
          orgRole: EnterpriseOrgUserRoles.ADMIN,
          req: { user: { id: outsiderUserId, roles: 'super' } } as any,
        });

        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('non-admin requester cannot add a user as ADMIN', async () => {
        // target user is not yet in the org; on-prem looks them up by email
        await expectForbidden(
          onPremService.addToOrg({
            email: targetEmail,
            orgRole: EnterpriseOrgUserRoles.ADMIN,
            req: { user: { id: creatorUserId } } as any,
          }),
        );

        const row = await fetchOrgUser(targetUserId);
        expect(row).to.equal(undefined);
      });

      it('admin requester can add a user as ADMIN', async () => {
        await onPremService.addToOrg({
          email: targetEmail,
          orgRole: EnterpriseOrgUserRoles.ADMIN,
          req: { user: { id: adminUserId } } as any,
        });

        const row = await fetchOrgUser(targetUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('blocks demoting the only admin', async () => {
        await expectBadRequest(
          onPremService.updateOrgRole({
            userId: adminUserId,
            orgRole: EnterpriseOrgUserRoles.CREATOR,
            req: { user: { id: adminUserId } } as any,
          }),
          /last org admin/i,
        );

        const row = await fetchOrgUser(adminUserId);
        expect(row?.roles).to.equal(EnterpriseOrgUserRoles.ADMIN);
      });

      it('blocks removing the only admin', async () => {
        await expectBadRequest(
          onPremService.removeFromOrg({
            userId: adminUserId,
            req: { user: { id: adminUserId } } as any,
          }),
          /last org (admin|owner)/i,
        );

        const row = await fetchOrgUser(adminUserId);
        expect(row?.deleted).to.not.equal(true);
      });
    });
  });
}
