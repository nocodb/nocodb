import 'mocha';
import { isEE } from 'playwright/setup/db';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { overrideFeature } from '../../../utils/plan.utils';

// routes
// List : http://localhost:8080/api/v3/meta/bases/{base_id}/users
// Invite : http://localhost:8080/api/v3/meta/bases/{base_id}/users
// Update : http://localhost:8080/api/v3/meta/bases/{base_id}/users
// Delete : http://localhost:8080/api/v3/meta/bases/{base_id}/users

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Base Users v3`, () => {
    let context: any = {};
    let baseId: string;
    let featureMock: any;

    beforeEach(async () => {
      context = await init();
      // List bases available in the workspace
      const listBases = await request(context.app)
        .get(`/api/v3/meta/workspaces/${context.fk_workspace_id}/bases`)
        .set('xc-token', context.xc_token)
        .expect(200);
      // Ensure bases list exists and is not empty
      expect(listBases.body.list).to.be.an('array').that.is.not.empty;

      // Select the first base ID
      baseId = listBases.body.list[0].id;
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT}`,
        allowed: true,
      });
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    const { expect } = require('chai');

    async function _validateBaseUser(user) {
      expect(user).to.be.an('object');
      expect(Object.keys(user)).to.include.members([
        'user_id',
        'email',
        'base_role',
        'created_at',
        ...(isEE() ? ['workspace_role'] : []),
      ]);

      expect(user).to.have.property('user_id').that.is.a('string');
      expect(user)
        .to.have.property('email')
        .that.is.a('string')
        .and.includes('@');
      expect(user).to.have.property('created_at').that.is.a('string');
      expect(user)
        .to.have.property('base_role')
        .that.is.a('string')
        .that.is.oneOf(['owner', 'creator', 'editor', 'commenter', 'viewer']);
      if (isEE()) {
        expect(user)
          .to.have.property('workspace_role')
          .that.is.a('string')
          .that.is.oneOf([
            'workspace-level-owner',
            'workspace-level-creator',
            'workspace-level-editor',
            'workspace-level-commenter',
            'workspace-level-viewer',
            'workspace-level-no-access',
          ]);
      }

      // Validate date fields are valid ISO strings
      expect(new Date(user.created_at)).to.be.a('date');
    }

    it('List Base Users v3', async () => {
      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}?include[]=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Log the response
      // console.log(JSON.stringify(getBaseUsers.body, null, 2));

      // Validation
      const baseMembers = getBaseUsers.body.individual_members.base_members;

      // Ensure base users list is an array
      expect(baseMembers).to.be.an('array').that.is.not.empty;
      await _validateBaseUser(baseMembers[0]);
    });
    it('Forbidden due to plan not sufficient', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT}`,
        allowed: false,
      });

      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}?include[]=members`)
        .set('xc-token', context.xc_token)
        .expect(403);
    });
    it('Invite Base User v3 - Email, Single', async () => {
      // Invite base user
      const inviteData = {
        email: 'user-0@nocodb.com',
        base_role: 'editor',
      };

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;

      await Promise.all(baseUsers.map(_validateBaseUser));

      const user0 = baseUsers.find((u) => u.email === 'user-0@nocodb.com');
      expect(user0).to.have.property('base_role', 'editor');
      if (isEE()) {
        expect(user0).to.have.property(
          'workspace_role',
          'workspace-level-no-access',
        );
      }
    });
    it('Invite Base User v3 - Email, Multiple', async () => {
      // Invite base user
      const inviteData = [
        {
          email: 'user-1@nocodb.com',
          base_role: 'editor',
        },
        {
          email: 'user-2@nocodb.com',
          base_role: 'viewer',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await Promise.all(baseUsers.map(_validateBaseUser));

      const user0 = baseUsers.find((u) => u.email === 'user-1@nocodb.com');
      expect(user0).to.have.property('base_role', 'editor');
      if (isEE()) {
        expect(user0).to.have.property(
          'workspace_role',
          'workspace-level-no-access',
        );
      }

      const user1 = baseUsers.find((u) => u.email === 'user-2@nocodb.com');
      expect(user1).to.have.property('base_role', 'viewer');
      if (isEE()) {
        expect(user1).to.have.property(
          'workspace_role',
          'workspace-level-no-access',
        );
      }
    });

    it('Invite Base User v3 - Base role not specified', async () => {
      // Invite base user
      const inviteData = [
        {
          email: 'user-0@nocodb.com',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(400);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const error = inviteBaseUser.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('msg', 'Invalid request body');
      expect(error.errors[0]).to.have.property(
        'message',
        "must have required property 'base_role'",
      );
    });
    it('Invite Base User v3 - Email/UserID not specified', async () => {
      // Invite base user
      const inviteData = [
        {
          base_role: 'editor',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(400);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const error = inviteBaseUser.body;
      expect(error).to.have.property(
        'msg',
        'Either email or user_id is required',
      );
    });
    it('Invite Base User v3 - using ID', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          user_id: user.id,
          base_role: 'editor',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await Promise.all(baseUsers.map(_validateBaseUser));
      const user0 = baseUsers.find((u) => u.user_id === user.id);
      expect(user0).to.have.property('base_role', 'editor');
      if (isEE()) {
        expect(user0).to.have.property(
          'workspace_role',
          'workspace-level-no-access',
        );
      }
    });

    // not supported anymore, for consistency
    it.skip('Update Base User v3 - using Email', async () => {
      // Invite base user
      const inviteData = {
        email: 'user-0@nocodb.com',
        base_role: 'editor',
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Update base user
      const updateData = [
        {
          email: 'user-0@nocodb.com',
          base_role: 'viewer',
        },
      ];

      const updateBaseUser = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // console.log(JSON.stringify(updateBaseUser.body, null, 2));

      // Validation
      const updatedUser = updateBaseUser.body;
      await _validateBaseUser(updatedUser[0]);
      expect(updatedUser[0]).to.have.property('base_role', 'viewer');
    });
    it('Update Base User v3 - using ID', async () => {
      // Invite base user
      const inviteData = [
        {
          email: 'user-0@nocodb.com',
          base_role: 'editor',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      const baseUsers = inviteBaseUser.body[0];

      // Update base user
      const updateData = [
        {
          user_id: baseUsers.user_id,
          base_role: 'viewer',
        },
      ];

      const updateBaseUser = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // console.log(JSON.stringify(updateBaseUser.body, null, 2));

      // Validation
      const updatedUser = updateBaseUser.body;
      await _validateBaseUser(updatedUser[0]);
      expect(updatedUser[0]).to.have.property('base_role', 'viewer');
    });
    it('Delete Base User v3 - using ID', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          user_id: user.id,
          base_role: 'editor',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Delete User
      await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: user.id }])
        .expect(200);
      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}?include[]=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // find the user
      const deletedUser =
        getBaseUsers.body.individual_members.base_members.find(
          (u) => u.user_id === user.id,
        );
      expect(deletedUser.base_role).to.be.equal('no-access');
    });

    // not supported anymore
    it.skip('Delete Base User v3 - using Email', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          user_id: user.id,
          base_role: 'editor',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Delete User
      await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ email: user.email }])
        .expect(200);

      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}?include[]=member`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // find the user
      const deletedUser =
        getBaseUsers.body.individual_members.base_members.find(
          (u) => u.user_id === user.id,
        );
      expect(deletedUser.base_role).to.be.equal('no-access');
    });

    // delete with email is not supported anymore
    it.skip('Delete Base User v3 - Bulk', async () => {
      const user1 = await createUser(context, {
        email: 'user-2@nocodb.com',
      });
      const user2 = await createUser(context, {
        email: 'user-3@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          user_id: user1.user.id,
          base_role: 'editor',
        },
        {
          user_id: user2.user.id,
          base_role: 'editor',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Delete User
      await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ email: 'user-2@nocodb.com' }, { email: 'user-3@nocodb.com' }])
        .expect(200);

      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}?include[]=member`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // find the user
      const deletedUser1 =
        getBaseUsers.body.individual_members.base_members.find(
          (u) => u.user_id === user1.user.id,
        );
      expect(deletedUser1.base_role).to.be.equal('no-access');

      const deletedUser2 =
        getBaseUsers.body.individual_members.base_members.find(
          (u) => u.user_id === user2.user.id,
        );
      expect(deletedUser2.base_role).to.be.equal('no-access');
    });

    // TODO: enable once the transaction issue is fixed
    it.skip('Delete Base User v3 - Transaction revert on one invalid', async () => {
      const user1 = await createUser(context, {
        email: 'user-2@nocodb.com',
      });
      const user2 = await createUser(context, {
        email: 'user-3@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          id: user1.user.id,
          base_role: 'editor',
        },
        {
          id: user2.user.id,
          base_role: 'editor',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Delete User
      await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send([{ email: 'user-2@nocodb.com' }, { email: 'user-23@nocodb.com' }])
        .expect(404);

      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // find the user
      const deletedUser1 = getBaseUsers.body.list.find(
        (u) => u.id === user1.user.id,
      );
      expect(deletedUser1.base_role).to.be.equal('editor');

      const deletedUser2 = getBaseUsers.body.list.find(
        (u) => u.id === user2.user.id,
      );
      expect(deletedUser2.base_role).to.be.equal('editor');
    });
  });
}
