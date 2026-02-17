import { HttpException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Team, WorkspaceUser } from '~/ee/models';
import { PrincipalAssignment } from '~/ee/models';
import { PrincipalType, ResourceType } from '~/utils/globals';

interface ScimGroupResource {
  schemas: string[];
  id: string;
  externalId?: string;
  displayName: string;
  members?: Array<{
    value: string;
    $ref?: string;
    type?: string;
    display?: string;
  }>;
  meta?: {
    resourceType: string;
    created?: string;
    lastModified?: string;
    location?: string;
  };
}

@Injectable()
export class ScimGroupsService {
  constructor() {}

  /**
   * Get a single group (team) by SCIM external ID
   */
  async getGroup(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      excludedAttributes?: string;
    },
  ) {
    const teams = await Team.list(context, {
      fk_workspace_id: param.workspaceId,
    });

    const team = teams.find((t) => t.scim_external_id === param.scimId);

    if (!team || team.deleted) {
      NcError.notFound('Group not found');
    }

    const excludeMembers = this.shouldExcludeMembers(param.excludedAttributes);
    return this.toScimGroup(context, team, param.workspaceId, excludeMembers);
  }

  /**
   * List groups with optional filtering and pagination
   */
  async listGroups(
    context: NcContext,
    param: {
      workspaceId: string;
      filter?: string;
      startIndex?: number;
      count?: number;
      excludedAttributes?: string;
    },
  ) {
    const startIndex = param.startIndex || 1;
    const count = Math.min(param.count || 100, 100);

    let teams = await Team.list(context, {
      fk_workspace_id: param.workspaceId,
    });

    // Filter SCIM-managed teams only
    teams = teams.filter((t) => t.scim_managed && !t.deleted);

    // Apply SCIM filter if provided
    if (param.filter) {
      teams = this.applyFilter(teams, param.filter);
    }

    const totalResults = teams.length;

    // Apply pagination
    const paginatedTeams = teams.slice(startIndex - 1, startIndex - 1 + count);

    const excludeMembers = this.shouldExcludeMembers(param.excludedAttributes);
    const resources = await Promise.all(
      paginatedTeams.map((t) =>
        this.toScimGroup(context, t, param.workspaceId, excludeMembers),
      ),
    );

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  /**
   * Create a new group (team) from SCIM data
   */
  async createGroup(
    context: NcContext,
    param: {
      workspaceId: string;
      scimGroup: any;
    },
  ) {
    const { scimGroup, workspaceId } = param;

    if (!scimGroup.displayName) {
      NcError.badRequest('displayName is required');
    }

    // Check if team with same name already exists
    const existingTeams = await Team.list(context, {
      fk_workspace_id: workspaceId,
    });

    const existingTeam = existingTeams.find(
      (t) => t.title === scimGroup.displayName && !t.deleted,
    );

    if (existingTeam) {
      // If team exists but not SCIM-managed, convert it to SCIM-managed
      if (!existingTeam.scim_managed) {
        await Team.update(context, existingTeam.id, {
          scim_external_id:
            scimGroup.externalId || scimGroup.id || uuidv4(),
          scim_managed: true,
          scim_display_name: scimGroup.displayName,
        });

        // Update membership to match SCIM
        if (scimGroup.members) {
          await this.updateTeamMembers(
            context,
            existingTeam.id,
            workspaceId,
            scimGroup.members,
          );
        }

        return this.toScimGroup(context, existingTeam, workspaceId);
      }

      // RFC 7644 §3.3: Return 409 Conflict for duplicate resources
      throw new HttpException(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          detail: 'Group with this name already exists',
          status: '409',
        },
        409,
      );
    }

    // Create new team
    const team = await Team.insert(context, {
      title: scimGroup.displayName,
      fk_workspace_id: workspaceId,
      scim_external_id: scimGroup.externalId || scimGroup.id || uuidv4(),
      scim_managed: true,
      scim_display_name: scimGroup.displayName,
    });

    // Add members if provided
    if (scimGroup.members?.length) {
      await this.updateTeamMembers(
        context,
        team.id,
        workspaceId,
        scimGroup.members,
      );
    }

    return this.toScimGroup(context, team, workspaceId);
  }

  /**
   * Update group (PATCH - partial update for membership)
   */
  async updateGroup(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      scimGroup: any;
    },
  ) {
    const { workspaceId, scimId, scimGroup } = param;

    const teams = await Team.list(context, {
      fk_workspace_id: workspaceId,
    });

    const team = teams.find((t) => t.scim_external_id === scimId);

    if (!team) {
      NcError.notFound('Group not found');
    }

    // Update team properties if provided
    const updateData: any = {};
    if (scimGroup.displayName && scimGroup.displayName !== team.title) {
      updateData.title = scimGroup.displayName;
      updateData.scim_display_name = scimGroup.displayName;
    }

    if (Object.keys(updateData).length > 0) {
      await Team.update(context, team.id, updateData);
    }

    // Handle membership updates
    if (scimGroup.members !== undefined) {
      await this.updateTeamMembers(
        context,
        team.id,
        workspaceId,
        scimGroup.members || [],
      );
    }

    // Handle SCIM PATCH operations
    if (scimGroup.Operations) {
      await this.applyPatchOperations(
        context,
        team,
        workspaceId,
        scimGroup.Operations,
      );
    }

    const updatedTeam = await Team.get(context, team.id);
    return this.toScimGroup(context, updatedTeam, workspaceId);
  }

  /**
   * Delete group (soft delete)
   */
  async deleteGroup(
    context: NcContext,
    param: { workspaceId: string; scimId: string },
  ) {
    const teams = await Team.list(context, {
      fk_workspace_id: param.workspaceId,
    });

    const team = teams.find((t) => t.scim_external_id === param.scimId);

    if (!team) {
      NcError.notFound('Group not found');
    }

    await Team.softDelete(context, team.id);
  }

  /**
   * Convert Team to SCIM Group format
   */
  private async toScimGroup(
    context: NcContext,
    team: any,
    workspaceId: string,
    excludeMembers = false,
  ): Promise<ScimGroupResource> {
    const result: ScimGroupResource = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: team.scim_external_id,
      externalId: team.scim_external_id,
      displayName: team.scim_display_name || team.title,
      meta: {
        resourceType: 'Group',
        location: `/scim/v2/Groups/${team.scim_external_id}`,
      },
    };

    if (!excludeMembers) {
      // Get team members
      const members = await this.getTeamMembers(context, team.id, workspaceId);
      result.members = members.map((member) => ({
        value: member.scim_external_id,
        $ref: `/scim/v2/Users/${member.scim_external_id}`,
        type: 'User',
        display: member.display_name || member.email,
      }));
    }

    return result;
  }

  /**
   * Check if 'members' should be excluded from the response
   */
  private shouldExcludeMembers(excludedAttributes?: string): boolean {
    if (!excludedAttributes) return false;
    return excludedAttributes
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .includes('members');
  }

  /**
   * Get team members (workspace users who are in the team)
   */
  private async getTeamMembers(
    context: NcContext,
    teamId: string,
    workspaceId: string,
  ): Promise<any[]> {
    // Get team user assignments
    const assignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.TEAM,
      resource_id: teamId,
    });

    const userIds = assignments
      .filter((a) => a.principal_type === PrincipalType.USER)
      .map((a) => a.principal_ref_id);

    // Get workspace users
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: workspaceId,
    });

    // Filter to team members who are SCIM-managed
    return workspaceUsers.filter(
      (wu) => userIds.includes(wu.fk_user_id) && wu.scim_managed,
    );
  }

  /**
   * Update team members to match SCIM group members
   */
  private async updateTeamMembers(
    context: NcContext,
    teamId: string,
    workspaceId: string,
    scimMembers: any[],
  ) {
    // Get current members
    const currentMembers = await this.getTeamMembers(
      context,
      teamId,
      workspaceId,
    );

    // Map SCIM member IDs to workspace users
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: workspaceId,
    });

    const targetMembers = scimMembers
      .map((m) => {
        const wu = workspaceUsers.find((wu) => wu.scim_external_id === m.value);
        return wu;
      })
      .filter((wu) => wu); // Filter out not found

    // Remove members not in target list
    for (const member of currentMembers) {
      if (!targetMembers.find((tm) => tm.fk_user_id === member.fk_user_id)) {
        await PrincipalAssignment.delete(
          context,
          ResourceType.TEAM,
          teamId,
          PrincipalType.USER,
          member.fk_user_id,
        );
      }
    }

    // Add new members
    for (const member of targetMembers) {
      const exists = currentMembers.find(
        (cm) => cm.fk_user_id === member.fk_user_id,
      );
      if (!exists) {
        await PrincipalAssignment.insert(context, {
          resource_type: ResourceType.TEAM,
          resource_id: teamId,
          principal_type: PrincipalType.USER,
          principal_ref_id: member.fk_user_id,
          roles: 'member',
        });
      }
    }
  }

  /**
   * Apply SCIM PATCH operations
   * Handles Replace, Add, and Remove operations per RFC 7644 Section 3.5.2
   */
  private async applyPatchOperations(
    context: NcContext,
    team: any,
    workspaceId: string,
    operations: any[],
  ) {
    for (const op of operations) {
      const opName = op.op?.toLowerCase();

      // Handle member operations (path = "members" or "members[value eq ...]")
      if (op.path === 'members' || op.path?.startsWith('members[')) {
        if (opName === 'add') {
          await this.addTeamMembers(context, team.id, workspaceId, op.value);
        } else if (opName === 'replace') {
          // Replace members entirely
          if (Array.isArray(op.value)) {
            await this.updateTeamMembers(
              context,
              team.id,
              workspaceId,
              op.value,
            );
          }
        } else if (opName === 'remove') {
          if (op.path?.startsWith('members[')) {
            // Parse filter: members[value eq "userId"]
            const filterMatch = op.path.match(
              /members\[value\s+eq\s+"([^"]+)"\]/i,
            );
            if (filterMatch) {
              await this.removeTeamMembers(context, team.id, workspaceId, [
                { value: filterMatch[1] },
              ]);
            }
          } else if (op.value) {
            await this.removeTeamMembers(
              context,
              team.id,
              workspaceId,
              op.value,
            );
          }
        }
      }
      // Handle Replace operations on group attributes
      else if (opName === 'replace') {
        const updateData: any = {};

        if (op.path) {
          // Path-targeted replace: { op: "replace", path: "displayName", value: "..." }
          if (op.path === 'displayName' && op.value) {
            updateData.title = op.value;
            updateData.scim_display_name = op.value;
          }
          if (op.path === 'externalId' && op.value) {
            updateData.scim_external_id = op.value;
          }
        } else if (op.value && typeof op.value === 'object') {
          // Bulk replace: { op: "replace", value: { displayName: "...", externalId: "..." } }
          if (op.value.displayName) {
            updateData.title = op.value.displayName;
            updateData.scim_display_name = op.value.displayName;
          }
          if (op.value.externalId) {
            updateData.scim_external_id = op.value.externalId;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await Team.update(context, team.id, updateData);
        }
      }
    }
  }

  /**
   * Add members to team
   */
  private async addTeamMembers(
    context: NcContext,
    teamId: string,
    workspaceId: string,
    members: any[],
  ) {
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: workspaceId,
    });

    // Get existing assignments to avoid duplicates
    const existingAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.TEAM,
      resource_id: teamId,
    });

    const existingUserIds = new Set(
      existingAssignments
        .filter((a) => a.principal_type === PrincipalType.USER)
        .map((a) => a.principal_ref_id),
    );

    for (const member of members) {
      const wu = workspaceUsers.find(
        (wu) => wu.scim_external_id === member.value,
      );
      if (wu && !existingUserIds.has(wu.fk_user_id)) {
        await PrincipalAssignment.insert(context, {
          resource_type: ResourceType.TEAM,
          resource_id: teamId,
          principal_type: PrincipalType.USER,
          principal_ref_id: wu.fk_user_id,
          roles: 'member',
        });
      }
    }
  }

  /**
   * Remove members from team
   */
  private async removeTeamMembers(
    context: NcContext,
    teamId: string,
    workspaceId: string,
    members: any[],
  ) {
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: workspaceId,
    });

    for (const member of members) {
      const wu = workspaceUsers.find(
        (wu) => wu.scim_external_id === member.value,
      );
      if (wu) {
        await PrincipalAssignment.delete(
          context,
          ResourceType.TEAM,
          teamId,
          PrincipalType.USER,
          wu.fk_user_id,
        );
      }
    }
  }

  /**
   * Apply SCIM filter with case-insensitive comparison (RFC 7644 §3.4.2.2)
   */
  private applyFilter(teams: any[], filter: string): any[] {
    // Support: displayName eq "Team Name"
    const displayNameMatch = filter.match(/displayName\s+eq\s+"([^"]+)"/i);
    if (displayNameMatch) {
      const displayName = displayNameMatch[1].toLowerCase();
      return teams.filter(
        (t) =>
          (t.scim_display_name || '').toLowerCase() === displayName ||
          (t.title || '').toLowerCase() === displayName,
      );
    }

    // Support: externalId eq "id"
    const externalIdMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i);
    if (externalIdMatch) {
      const externalId = externalIdMatch[1].toLowerCase();
      return teams.filter(
        (t) => (t.scim_external_id || '').toLowerCase() === externalId,
      );
    }

    return teams;
  }
}
