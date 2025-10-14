import 'mocha';
import { isEE } from 'playwright/setup/db';
import request from 'supertest';
import init from '../../../init';
import { createUser } from '../../../factory/user';

// routes
// List : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}?include=members
// Invite : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/members
// Update : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/members
// Delete : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/members

export default function () {
  // Skipping since API not available in current test environment
  describe.skip(`Workspace Users v3`, () => {
    let context: any = {};
    let workspaceId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id;
    });

    const { expect } = require('chai');

    async function _validateWorkspaceUser(user) {
      expect(user).to.be.an('object');
      expect(Object.keys(user)).to.include.members([
        'email',
        'user_id',
        'workspace_role',
        'created_at',
        'updated_at',
      ]);

      expect(user).to.have.property('user_id').that.is.a('string');
      expect(user)
        .to.have.property('email')
        .that.is.a('string')
        .and.includes('@');
      expect(user).to.have.property('created_at').that.is.a('string');
      expect(user).to.have.property('updated_at').that.is.a('string');
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

      // Validate date fields are valid ISO strings
      expect(new Date(user.created_at)).to.be.a('date');
      expect(new Date(user.updated_at)).to.be.a('date');
    }

    it('List Workspace Members v3', async () => {
      // Get workspace members using workspace read API with include=members
      const getWorkspaceMembers = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const workspace = getWorkspaceMembers.body;
      expect(workspace).to.have.property('individual_members');
      expect(workspace.individual_members).to.have.property(
        'workspace_members',
      );

      const workspaceMembers = workspace.individual_members.workspace_members;

      // Ensure workspace members list is an array
      expect(workspaceMembers).to.be.an('array').that.is.not.empty;

      // Validate the first member structure
      const firstMember = workspaceMembers[0];
      expect(firstMember).to.have.property('email').that.is.a('string');
      expect(firstMember).to.have.property('user_id').that.is.a('string');
      expect(firstMember).to.have.property('created_at').that.is.a('string');
      expect(firstMember).to.have.property('updated_at').that.is.a('string');
      expect(firstMember)
        .to.have.property('workspace_role')
        .that.is.a('string');
    });

    it('Invite Workspace Member v3 - Email, Single', async () => {
      // Invite workspace member
      const inviteData = {
        email: 'user-0@nocodb.com',
        workspace_role: 'workspace-level-editor',
      };

      const inviteWorkspaceMember = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Validation
      const workspaceMembers = inviteWorkspaceMember.body;
      expect(workspaceMembers).to.be.an('array').that.is.not.empty;
      await Promise.all(workspaceMembers.map(_validateWorkspaceUser));

      const user0 = workspaceMembers.find(
        (u) => u.email === 'user-0@nocodb.com',
      );
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-editor',
      );
    });

    it('Invite Workspace Member v3 - Email, Multiple', async () => {
      // Invite workspace members
      const inviteData = [
        {
          email: 'user-1@nocodb.com',
          workspace_role: 'workspace-level-editor',
        },
        {
          email: 'user-2@nocodb.com',
          workspace_role: 'workspace-level-viewer',
        },
      ];

      const inviteWorkspaceMembers = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Validation
      const workspaceMembers = inviteWorkspaceMembers.body;
      expect(workspaceMembers).to.be.an('array').that.is.not.empty;
      await Promise.all(workspaceMembers.map(_validateWorkspaceUser));

      const user0 = workspaceMembers.find(
        (u) => u.email === 'user-1@nocodb.com',
      );
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-editor',
      );

      const user1 = workspaceMembers.find(
        (u) => u.email === 'user-2@nocodb.com',
      );
      expect(user1).to.have.property(
        'workspace_role',
        'workspace-level-viewer',
      );
    });

    it('Invite Workspace Member v3 - Workspace role not specified', async () => {
      // Invite workspace member without role
      const inviteData = [
        {
          email: 'user-0@nocodb.com',
        },
      ];

      const inviteWorkspaceMember = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(400);

      // Validation
      const error = inviteWorkspaceMember.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('msg', 'Invalid request body');
      expect(error.errors[0]).to.have.property(
        'message',
        "must have required property 'workspace_role'",
      );
    });

    it('Invite Workspace Member v3 - Email/UserID not specified', async () => {
      // Invite workspace member without email or ID
      const inviteData = [
        {
          workspace_role: 'workspace-level-editor',
        },
      ];

      const inviteWorkspaceMember = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(400);

      // Validation
      const error = inviteWorkspaceMember.body;
      expect(error).to.have.property('msg', 'Either email or user_id is required');
    });

    it('Invite Workspace Member v3 - using ID', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Invite workspace member using ID
      const inviteData = [
        {
          user_id: user.id,
          workspace_role: 'workspace-level-editor',
        },
      ];

      const inviteWorkspaceMember = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Validation
      const workspaceMembers = inviteWorkspaceMember.body;
      expect(workspaceMembers).to.be.an('array').that.is.not.empty;
      await Promise.all(workspaceMembers.map(_validateWorkspaceUser));

      const user0 = workspaceMembers.find((u) => u.user_id === user.id);
      expect(user0).to.have.property(
        'workspace_role',
        'workspace-level-editor',
      );
    });

    it('Update Workspace Member v3 - using ID', async () => {
      // First invite a workspace member
      const inviteData = {
        email: 'user-0@nocodb.com',
        workspace_role: 'workspace-level-editor',
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Get the member to get their ID using workspace read API
      const getMembers = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const member = getMembers.body.individual_members.workspace_members.find(
        (u) => u.email === 'user-0@nocodb.com',
      );

      if (!member) {
        throw new Error('Failed to find invited member');
      }

      // Update workspace member
      const updateData = [
        {
          user_id: member.user_id,
          workspace_role: 'workspace-level-viewer',
        },
      ];

      const updateWorkspaceMember = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // Validation
      const updatedMember = updateWorkspaceMember.body;
      await _validateWorkspaceUser(updatedMember[0]);
      expect(updatedMember[0]).to.have.property(
        'workspace_role',
        'workspace-level-viewer',
      );
    });

    it('Update Workspace Member v3 - Bulk Update', async () => {
      // First invite multiple workspace members
      const inviteData = [
        {
          email: 'user-1@nocodb.com',
          workspace_role: 'workspace-level-editor',
        },
        {
          email: 'user-2@nocodb.com',
          workspace_role: 'workspace-level-viewer',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Get the members to get their IDs using workspace read API
      const getMembers = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const member1 = getMembers.body.individual_members.workspace_members.find(
        (u) => u.email === 'user-1@nocodb.com',
      );
      const member2 = getMembers.body.individual_members.workspace_members.find(
        (u) => u.email === 'user-2@nocodb.com',
      );

      if (!member1 || !member2) {
        throw new Error('Failed to find invited members');
      }

      // Update multiple workspace members
      const updateData = [
        {
          user_id: member1.user_id,
          workspace_role: 'workspace-level-viewer',
        },
        {
          user_id: member2.user_id,
          workspace_role: 'workspace-level-editor',
        },
      ];

      const updateWorkspaceMembers = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // Validation
      const updatedMembers = updateWorkspaceMembers.body;
      expect(updatedMembers).to.be.an('array').that.has.length(2);

      const updatedMember1 = updatedMembers.find(
        (u) => u.user_id === member1.user_id,
      );
      expect(updatedMember1).to.have.property(
        'workspace_role',
        'workspace-level-viewer',
      );

      const updatedMember2 = updatedMembers.find(
        (u) => u.user_id === member2.user_id,
      );
      expect(updatedMember2).to.have.property(
        'workspace_role',
        'workspace-level-editor',
      );
    });

    it('Delete Workspace Member v3 - using ID', async () => {
      const { user } = await createUser(context, {
        email: 'user-2@nocodb.com',
      });

      // First invite the user
      const inviteData = [
        {
          user_id: user.id,
          workspace_role: 'workspace-level-editor',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Delete workspace member
      const deleteResponse = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: user.id }])
        .expect(200);

      // Validation
      expect(deleteResponse.body).to.have.property(
        'msg',
        'The user has been deleted successfully',
      );

      // Verify the user is no longer in the workspace members list
      const getMembers = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const deletedMember =
        getMembers.body.individual_members.workspace_members.find(
          (u) => u.user_id === user.id,
        );
      expect(deletedMember).to.be.undefined;
    });

    it('Delete Workspace Member v3 - Bulk Delete', async () => {
      const user1 = await createUser(context, {
        email: 'user-2@nocodb.com',
      });
      const user2 = await createUser(context, {
        email: 'user-3@nocodb.com',
      });

      // First invite both users
      const inviteData = [
        {
          user_id: user1.user.id,
          workspace_role: 'workspace-level-editor',
        },
        {
          user_id: user2.user.id,
          workspace_role: 'workspace-level-viewer',
        },
      ];

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Delete multiple workspace members
      const deleteResponse = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: user1.user.id }, { user_id: user2.user.id }])
        .expect(200);

      // Validation
      expect(deleteResponse.body).to.have.property(
        'msg',
        'The user has been deleted successfully',
      );

      // Verify both users are no longer in the workspace members list
      const getMembers = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const deletedMember1 =
        getMembers.body.individual_members.workspace_members.find(
          (u) => u.user_id === user1.user.id,
        );
      const deletedMember2 =
        getMembers.body.individual_members.workspace_members.find(
          (u) => u.user_id === user2.user.id,
        );

      expect(deletedMember1).to.be.undefined;
      expect(deletedMember2).to.be.undefined;
    });

    it('Workspace Read v3 - Basic', async () => {
      // Get workspace metadata
      const getWorkspace = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const workspace = getWorkspace.body;
      expect(workspace).to.be.an('object');
      expect(workspace).to.have.property('id', workspaceId);
      expect(workspace).to.have.property('title').that.is.a('string');
      expect(workspace).to.have.property('created_at').that.is.a('string');
      expect(workspace).to.have.property('updated_at').that.is.a('string');

      // Should not include members by default
      expect(workspace).to.not.have.property('individual_members');
    });

    it('Workspace Read v3 - With Members', async () => {
      // First invite a member
      const inviteData = {
        email: 'user-0@nocodb.com',
        workspace_role: 'workspace-level-editor',
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(inviteData)
        .expect(200);

      // Get workspace metadata with members
      const getWorkspace = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const workspace = getWorkspace.body;
      expect(workspace).to.be.an('object');
      expect(workspace).to.have.property('id', workspaceId);
      expect(workspace).to.have.property('title').that.is.a('string');
      expect(workspace).to.have.property('created_at').that.is.a('string');
      expect(workspace).to.have.property('updated_at').that.is.a('string');

      // Should include members when requested
      expect(workspace).to.have.property('individual_members');
      expect(workspace.individual_members).to.have.property(
        'workspace_members',
      );
      expect(workspace.individual_members.workspace_members).to.be.an('array')
        .that.is.not.empty;

      // Validate the member structure
      const member = workspace.individual_members.workspace_members[0];
      expect(member).to.have.property('email').that.is.a('string');
      expect(member).to.have.property('user_id').that.is.a('string');
      expect(member).to.have.property('created_at').that.is.a('string');
      expect(member).to.have.property('updated_at').that.is.a('string');
      expect(member).to.have.property('workspace_role').that.is.a('string');
    });

    it('Workspace Read v3 - Include Members Array Format', async () => {
      // Get workspace metadata with members using array format
      const getWorkspace = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include[]=members`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const workspace = getWorkspace.body;
      expect(workspace).to.be.an('object');
      expect(workspace).to.have.property('individual_members');
      expect(workspace.individual_members).to.have.property(
        'workspace_members',
      );
    });

    it('Workspace Read v3 - Invalid Include Parameter', async () => {
      // Get workspace metadata with invalid include parameter
      const getWorkspace = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}?include=invalid`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation - should still return workspace but without members
      const workspace = getWorkspace.body;
      expect(workspace).to.be.an('object');
      expect(workspace).to.have.property('id', workspaceId);
      expect(workspace).to.not.have.property('individual_members');
    });
  });
}
