import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ScimGroupsService } from '../scim-groups.service';

// ─── Mock Stores ─────────────────────────────────────────────────────

let mockTeams: any[] = [];
let mockWorkspaceUsers: any[] = [];
let mockAssignments: any[] = [];
let nextTeamId = 1;

jest.mock('~/ee/models', () => ({
  Team: {
    list: jest.fn((_ctx: any, { fk_workspace_id }: any) => {
      return Promise.resolve(
        mockTeams.filter((t) => t.fk_workspace_id === fk_workspace_id),
      );
    }),
    get: jest.fn((_ctx: any, id: string) => {
      return Promise.resolve(mockTeams.find((t) => t.id === id) || null);
    }),
    insert: jest.fn((_ctx: any, data: any) => {
      const id = `team_${nextTeamId++}`;
      const team = { id, ...data };
      mockTeams.push(team);
      return Promise.resolve(team);
    }),
    update: jest.fn((_ctx: any, id: string, data: any) => {
      const team = mockTeams.find((t) => t.id === id);
      if (team) Object.assign(team, data);
      return Promise.resolve(true);
    }),
    softDelete: jest.fn((_ctx: any, id: string) => {
      const team = mockTeams.find((t) => t.id === id);
      if (team) team.deleted = true;
      return Promise.resolve(true);
    }),
  },
  WorkspaceUser: {
    userList: jest.fn(({ fk_workspace_id }: any) => {
      return Promise.resolve(
        mockWorkspaceUsers.filter(
          (wu) => wu.fk_workspace_id === fk_workspace_id && !wu.deleted,
        ),
      );
    }),
  },
  PrincipalAssignment: {
    list: jest.fn(
      (_ctx: any, { resource_type, resource_id }: any) => {
        return Promise.resolve(
          mockAssignments.filter(
            (a) =>
              a.resource_type === resource_type &&
              a.resource_id === resource_id,
          ),
        );
      },
    ),
    insert: jest.fn((_ctx: any, data: any) => {
      mockAssignments.push(data);
      return Promise.resolve(data);
    }),
    delete: jest.fn(
      (
        _ctx: any,
        resource_type: string,
        resource_id: string,
        principal_type: string,
        principal_ref_id: string,
      ) => {
        mockAssignments = mockAssignments.filter(
          (a) =>
            !(
              a.resource_type === resource_type &&
              a.resource_id === resource_id &&
              a.principal_type === principal_type &&
              a.principal_ref_id === principal_ref_id
            ),
        );
        return Promise.resolve(true);
      },
    ),
    get: jest.fn(
      (
        _ctx: any,
        resource_type: string,
        resource_id: string,
        principal_type: string,
        principal_ref_id: string,
      ) => {
        return Promise.resolve(
          mockAssignments.find(
            (a) =>
              a.resource_type === resource_type &&
              a.resource_id === resource_id &&
              a.principal_type === principal_type &&
              a.principal_ref_id === principal_ref_id,
          ) || null,
        );
      },
    ),
  },
}));

jest.mock('~/Noco', () => ({
  __esModule: true,
  default: { ncMeta: {} },
}));

jest.mock('~/utils/globals', () => ({
  PrincipalType: { USER: 'USER' },
  ResourceType: { TEAM: 'TEAM' },
}));

// ─── Helpers ─────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws_test_001';
const CONTEXT = { workspace_id: WORKSPACE_ID, base_id: null };

function seedTeam(overrides: Partial<any> = {}) {
  const id = `team_${nextTeamId++}`;
  const externalId = overrides.scim_external_id || `ext_${id}`;
  const team = {
    id,
    title: overrides.title || `Team ${id}`,
    fk_workspace_id: WORKSPACE_ID,
    scim_external_id: externalId,
    scim_managed: true,
    scim_display_name: overrides.scim_display_name || overrides.title || `Team ${id}`,
    deleted: false,
    ...overrides,
  };
  mockTeams.push(team);
  return team;
}

function seedScimUser(externalId: string, email: string) {
  const userId = `usr_${externalId}`;
  const wsUser = {
    fk_workspace_id: WORKSPACE_ID,
    fk_user_id: userId,
    scim_external_id: externalId,
    scim_managed: true,
    email,
    display_name: email.split('@')[0],
    deleted: false,
  };
  mockWorkspaceUsers.push(wsUser);
  return wsUser;
}

function seedAssignment(teamId: string, userId: string) {
  mockAssignments.push({
    resource_type: 'TEAM',
    resource_id: teamId,
    principal_type: 'USER',
    principal_ref_id: userId,
    roles: null,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('ScimGroupsService', () => {
  let service: ScimGroupsService;

  beforeEach(async () => {
    mockTeams = [];
    mockWorkspaceUsers = [];
    mockAssignments = [];
    nextTeamId = 1;

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScimGroupsService],
    }).compile();

    service = module.get<ScimGroupsService>(ScimGroupsService);
  });

  // ── createGroup ──────────────────────────────────────────────────

  describe('createGroup', () => {
    it('should create a new SCIM-managed team', async () => {
      const result = await service.createGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimGroup: {
          displayName: 'Engineering',
          externalId: 'ext-eng-001',
        },
      });

      expect(result).toBeDefined();
      expect(result.schemas).toContain(
        'urn:ietf:params:scim:schemas:core:2.0:Group',
      );
      expect(result.displayName).toBe('Engineering');
      expect(result.id).toBe('ext-eng-001');
    });

    it('should throw when displayName is missing', async () => {
      await expect(
        service.createGroup(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          scimGroup: {},
        }),
      ).rejects.toThrow();
    });

    it('should convert existing non-SCIM team to SCIM-managed', async () => {
      // Pre-create a non-SCIM team
      mockTeams.push({
        id: 'team_existing',
        title: 'Existing Team',
        fk_workspace_id: WORKSPACE_ID,
        scim_managed: false,
        deleted: false,
      });

      const result = await service.createGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimGroup: {
          displayName: 'Existing Team',
          externalId: 'ext-existing',
        },
      });

      expect(result).toBeDefined();
      const team = mockTeams.find((t) => t.id === 'team_existing');
      expect(team.scim_managed).toBe(true);
      expect(team.scim_external_id).toBe('ext-existing');
    });

    it('should throw when duplicate SCIM team exists', async () => {
      seedTeam({ title: 'Dup Team' });

      await expect(
        service.createGroup(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          scimGroup: {
            displayName: 'Dup Team',
            externalId: 'ext-dup',
          },
        }),
      ).rejects.toThrow();
    });

    it('should create group with initial members', async () => {
      const user = seedScimUser('ext_user_1', 'alice@example.com');

      const result = await service.createGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimGroup: {
          displayName: 'With Members',
          externalId: 'ext-with-members',
          members: [{ value: 'ext_user_1' }],
        },
      });

      expect(result.members).toBeDefined();
      expect(result.members.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── getGroup ─────────────────────────────────────────────────────

  describe('getGroup', () => {
    it('should return SCIM-formatted group', async () => {
      const team = seedTeam({
        title: 'Get Test',
        scim_display_name: 'Get Test',
      });

      const result = await service.getGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
      });

      expect(result.schemas).toContain(
        'urn:ietf:params:scim:schemas:core:2.0:Group',
      );
      expect(result.displayName).toBe('Get Test');
      expect(result.meta.resourceType).toBe('Group');
      expect(result.meta.location).toContain('/scim/v2/Groups/');
    });

    it('should include members in response', async () => {
      const team = seedTeam({ title: 'Members Test' });
      const user = seedScimUser('ext_member_1', 'member@example.com');
      seedAssignment(team.id, user.fk_user_id);

      const result = await service.getGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
      });

      expect(result.members).toBeDefined();
      expect(result.members.length).toBe(1);
      expect(result.members[0].value).toBe('ext_member_1');
      expect(result.members[0].type).toBe('User');
      expect(result.members[0].$ref).toContain('/scim/v2/Users/');
    });

    it('should throw notFound for deleted group', async () => {
      const team = seedTeam({ deleted: true });

      await expect(
        service.getGroup(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          scimId: team.scim_external_id,
        }),
      ).rejects.toThrow();
    });

    it('should throw notFound for non-existent scimId', async () => {
      await expect(
        service.getGroup(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          scimId: 'nonexistent',
        }),
      ).rejects.toThrow();
    });
  });

  // ── listGroups ───────────────────────────────────────────────────

  describe('listGroups', () => {
    it('should return only SCIM-managed, non-deleted groups', async () => {
      seedTeam({ title: 'Active SCIM' });
      seedTeam({ title: 'Deleted SCIM', deleted: true });

      // Non-SCIM team
      mockTeams.push({
        id: 'team_manual',
        title: 'Manual Team',
        fk_workspace_id: WORKSPACE_ID,
        scim_managed: false,
        deleted: false,
      });

      const result = await service.listGroups(CONTEXT, {
        workspaceId: WORKSPACE_ID,
      });

      expect(result.totalResults).toBe(1);
      expect(result.Resources[0].displayName).toBe('Active SCIM');
    });

    it('should support displayName eq filter', async () => {
      seedTeam({ title: 'Alpha', scim_display_name: 'Alpha' });
      seedTeam({ title: 'Beta', scim_display_name: 'Beta' });

      const result = await service.listGroups(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        filter: 'displayName eq "Alpha"',
      });

      expect(result.totalResults).toBe(1);
      expect(result.Resources[0].displayName).toBe('Alpha');
    });

    it('should support externalId eq filter', async () => {
      seedTeam({ scim_external_id: 'ext_target' });
      seedTeam({ scim_external_id: 'ext_other' });

      const result = await service.listGroups(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        filter: 'externalId eq "ext_target"',
      });

      expect(result.totalResults).toBe(1);
    });

    it('should paginate correctly', async () => {
      for (let i = 0; i < 5; i++) {
        seedTeam({ title: `Team ${i}` });
      }

      const page1 = await service.listGroups(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        startIndex: 1,
        count: 2,
      });

      expect(page1.totalResults).toBe(5);
      expect(page1.itemsPerPage).toBe(2);
      expect(page1.Resources).toHaveLength(2);
    });

    it('should return ListResponse schema', async () => {
      const result = await service.listGroups(CONTEXT, {
        workspaceId: WORKSPACE_ID,
      });

      expect(result.schemas).toContain(
        'urn:ietf:params:scim:api:messages:2.0:ListResponse',
      );
      expect(result).toHaveProperty('totalResults');
      expect(result).toHaveProperty('startIndex');
      expect(result).toHaveProperty('itemsPerPage');
      expect(result).toHaveProperty('Resources');
    });
  });

  // ── updateGroup ──────────────────────────────────────────────────

  describe('updateGroup', () => {
    it('should update displayName', async () => {
      const team = seedTeam({ title: 'Old Name', scim_display_name: 'Old Name' });

      await service.updateGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
        scimGroup: { displayName: 'New Name' },
      });

      const updated = mockTeams.find((t) => t.id === team.id);
      expect(updated.title).toBe('New Name');
      expect(updated.scim_display_name).toBe('New Name');
    });

    it('should throw when group not found', async () => {
      await expect(
        service.updateGroup(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          scimId: 'nonexistent',
          scimGroup: { displayName: 'X' },
        }),
      ).rejects.toThrow();
    });

    it('should handle PATCH Operations for adding members', async () => {
      const team = seedTeam({ title: 'Ops Team' });
      const user = seedScimUser('ext_op_user', 'op@example.com');

      await service.updateGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
        scimGroup: {
          Operations: [
            {
              op: 'add',
              path: 'members',
              value: [{ value: 'ext_op_user' }],
            },
          ],
        },
      });

      const assignment = mockAssignments.find(
        (a) =>
          a.resource_id === team.id &&
          a.principal_ref_id === user.fk_user_id,
      );
      expect(assignment).toBeDefined();
    });

    it('should handle PATCH Operations for removing members', async () => {
      const team = seedTeam({ title: 'Remove Team' });
      const user = seedScimUser('ext_remove_user', 'remove@example.com');
      seedAssignment(team.id, user.fk_user_id);

      await service.updateGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
        scimGroup: {
          Operations: [
            {
              op: 'remove',
              path: 'members',
              value: [{ value: 'ext_remove_user' }],
            },
          ],
        },
      });

      const assignment = mockAssignments.find(
        (a) =>
          a.resource_id === team.id &&
          a.principal_ref_id === user.fk_user_id,
      );
      expect(assignment).toBeUndefined();
    });

    it('should replace all members when members array is provided', async () => {
      const team = seedTeam({ title: 'Replace Team' });
      const user1 = seedScimUser('ext_keep', 'keep@example.com');
      const user2 = seedScimUser('ext_drop', 'drop@example.com');
      const user3 = seedScimUser('ext_new', 'new@example.com');

      seedAssignment(team.id, user1.fk_user_id);
      seedAssignment(team.id, user2.fk_user_id);

      await service.updateGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
        scimGroup: {
          members: [{ value: 'ext_keep' }, { value: 'ext_new' }],
        },
      });

      // user2 (ext_drop) should be removed
      const dropAssignment = mockAssignments.find(
        (a) =>
          a.resource_id === team.id &&
          a.principal_ref_id === user2.fk_user_id,
      );
      expect(dropAssignment).toBeUndefined();

      // user3 (ext_new) should be added
      const newAssignment = mockAssignments.find(
        (a) =>
          a.resource_id === team.id &&
          a.principal_ref_id === user3.fk_user_id,
      );
      expect(newAssignment).toBeDefined();
    });
  });

  // ── deleteGroup ──────────────────────────────────────────────────

  describe('deleteGroup', () => {
    it('should soft-delete the team', async () => {
      const team = seedTeam({ title: 'To Delete' });

      const result = await service.deleteGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
      });

      expect(result.status).toBe('deleted');
      const deleted = mockTeams.find((t) => t.id === team.id);
      expect(deleted.deleted).toBe(true);
    });

    it('should throw when group not found', async () => {
      await expect(
        service.deleteGroup(CONTEXT, {
          workspaceId: WORKSPACE_ID,
          scimId: 'nonexistent',
        }),
      ).rejects.toThrow();
    });
  });

  // ── SCIM Response Format ─────────────────────────────────────────

  describe('SCIM response format', () => {
    it('should include all required SCIM 2.0 Group fields', async () => {
      const team = seedTeam({ title: 'Format Check' });

      const result = await service.getGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
      });

      expect(result.schemas).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.displayName).toBeDefined();
      expect(result.members).toBeDefined();
      expect(Array.isArray(result.members)).toBe(true);
      expect(result.meta).toBeDefined();
      expect(result.meta.resourceType).toBe('Group');
    });

    it('should format member references correctly', async () => {
      const team = seedTeam({ title: 'Ref Check' });
      const user = seedScimUser('ext_ref', 'ref@example.com');
      seedAssignment(team.id, user.fk_user_id);

      const result = await service.getGroup(CONTEXT, {
        workspaceId: WORKSPACE_ID,
        scimId: team.scim_external_id,
      });

      const member = result.members[0];
      expect(member).toHaveProperty('value');
      expect(member).toHaveProperty('$ref');
      expect(member).toHaveProperty('type');
      expect(member).toHaveProperty('display');
      expect(member.$ref).toMatch(/\/scim\/v2\/Users\//);
    });
  });
});
