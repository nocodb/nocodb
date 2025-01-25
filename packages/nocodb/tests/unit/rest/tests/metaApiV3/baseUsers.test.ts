import 'mocha';
import request from 'supertest';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { expect } from 'chai';

// routes
// List : http://localhost:8080/api/v3/meta/bases/{base_id}/users
// Invite : http://localhost:8080/api/v3/meta/bases/{base_id}/users
// Update : http://localhost:8080/api/v3/meta/bases/{base_id}/users
// Delete : http://localhost:8080/api/v3/meta/bases/{base_id}/users

export default function () {
  describe.only(`Base Users v3`, () => {
    let context: any = {};
    let baseId: string;

    before(async () => {
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
    });

    const { expect } = require('chai');

    async function _validateBaseUser(user) {
      expect(user).to.be.an('object');
      expect(Object.keys(user)).to.include.members([
        'id',
        'email',
        'base_role',
        'workspace_role',
        'created_at',
        'updated_at',
        'workspace_id',
      ]);

      expect(user).to.have.property('id').that.is.a('string');
      expect(user)
        .to.have.property('email')
        .that.is.a('string')
        .and.includes('@');
      expect(user).to.have.property('created_at').that.is.a('string');
      expect(user).to.have.property('updated_at').that.is.a('string');
      expect(user)
        .to.have.property('base_role')
        .that.is.oneOf(['owner', 'creator', 'editor', 'commenter', 'viewer']);
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
      expect(user).to.have.property('workspace_id', context.fk_workspace_id);

      // Validate date fields are valid ISO strings
      expect(new Date(user.created_at)).to.be.a('date');
      expect(new Date(user.updated_at)).to.be.a('date');
    }

    it('List Base Users v3', async () => {
      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Log the response
      // console.log(JSON.stringify(getBaseUsers.body, null, 2));

      // Validation
      const baseUsers = getBaseUsers.body.list;

      // Ensure base users list is an array
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await _validateBaseUser(baseUsers[0]);
    });
    it('Invite Base User v3 - Email, Single', async () => {
      // Invite base user
      const inviteData = {
        email: 'user-0@nocodb.com',
        base_role: 'editor',
      };

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(201);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await Promise.all(baseUsers.map(_validateBaseUser));

      const user0 = baseUsers.find((u) => u.email === 'user-0@nocodb.com');
      expect(user0).to.have.property('base_role', 'editor');
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-no-access',
      );
    });
    it('Invite Base User v3 - Email, Multiple', async () => {
      // Invite base user
      const inviteData = [
        {
          email: 'user-0@nocodb.com',
          base_role: 'editor',
        },
        {
          email: 'user-1@nocodb.com',
          base_role: 'viewer',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(201);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await Promise.all(baseUsers.map(_validateBaseUser));

      const user0 = baseUsers.find((u) => u.email === 'user-0@nocodb.com');
      expect(user0).to.have.property('base_role', 'editor');
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-no-access',
      );

      const user1 = baseUsers.find((u) => u.email === 'user-1@nocodb.com');
      expect(user1).to.have.property('base_role', 'viewer');
      expect(user1).to.have.property(
        'workspace_role',
        'workspace-level-no-access',
      );
    });
    it('Invite Base User v3 - Base role not specified', async () => {
      // Invite base user
      const inviteData = [
        {
          email: 'user-0@nocodb.com',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
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
        "must have required property 'roles'",
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
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(400);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const error = inviteBaseUser.body;
      expect(error).to.have.property('msg', 'Either email or id is required');
    });
    it('Invite Base User v3 - using ID', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          id: user.id,
          base_role: 'editor',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(201);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await Promise.all(baseUsers.map(_validateBaseUser));

      const user0 = baseUsers.find((u) => u.id === user.id);
      expect(user0).to.have.property('base_role', 'editor');
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-no-access',
      );
    });
    it('Update Base User v3 - using Email', async () => {
      // Invite base user
      const inviteData = {
        email: 'user-0@nocodb.com',
        base_role: 'editor',
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(201);

      // Update base user
      const updateData = [
        {
          email: 'user-0@nocodb.com',
          base_role: 'viewer',
        },
      ];

      const updateBaseUser = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(updateData);

      console.log(JSON.stringify(updateBaseUser.body, null, 2));

      // Validation
      const updatedUser = updateBaseUser.body;
      await _validateBaseUser(updatedUser);
      expect(updatedUser).to.have.property('base_role', 'viewer');
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
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(201);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      const baseUsers = inviteBaseUser.body[0];

      // Update base user
      const updateData = [
        {
          id: baseUsers.id,
          base_role: 'viewer',
        },
      ];

      const updateBaseUser = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // console.log(JSON.stringify(updateBaseUser.body, null, 2));

      // Validation
      const updatedUser = updateBaseUser.body;
      await _validateBaseUser(updatedUser);
      expect(updatedUser).to.have.property('base_role', 'viewer');
    });
    it('Delete Base User v3 - using ID', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      // Invite base user
      const inviteData = [
        {
          id: user.id,
          base_role: 'editor',
        },
      ];

      const inviteBaseUser = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(201);

      // console.log(JSON.stringify(inviteBaseUser.body, null, 2));

      // Validation
      const baseUsers = inviteBaseUser.body;
      expect(baseUsers).to.be.an('array').that.is.not.empty;
      await Promise.all(baseUsers.map(_validateBaseUser));

      const user0 = baseUsers.find((u) => u.id === user.id);
      expect(user0).to.have.property('base_role', 'editor');
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-no-access',
      );

      // Delete User
      await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send([{ id: user.id }])
        .expect(200);

      // Get base users
      const getBaseUsers = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .expect(200);
    });
  });
}
