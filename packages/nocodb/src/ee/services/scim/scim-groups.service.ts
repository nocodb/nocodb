import { HttpException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Team, WorkspaceUser } from '~/ee/models';
import { PrincipalAssignment } from '~/ee/models';
import { PrincipalType, ResourceType } from '~/utils/globals';
import {
  extractWorkspaceRoleFromExtension,
  NOCODB_GROUP_EXTENSION,
  WORKSPACE_ROLE_TO_LABEL,
} from '~/services/scim/scim-helpers';

@Injectable()
export class ScimGroupsService {
  protected logger = new Logger(ScimGroupsService.name);

  constructor() {}

  /**
   * Extract workspaceRole from SCIM extension attribute.
   * Returns the WorkspaceUserRoles enum value, or undefined if not present.
   */
  private extractWorkspaceRole(
    scimGroup: Record<string, unknown>,
  ): WorkspaceUserRoles | undefined {
    return extractWorkspaceRoleFromExtension(scimGroup, NOCODB_GROUP_EXTENSION);
  }

  /**
   * Create or update the workspace-level PrincipalAssignment for a team.
   * This is what gives the team (and its members) a workspace role.
   */
  private async assignWorkspaceRole(
    context: NcContext,
    teamId: string,
    workspaceId: string,
    role: WorkspaceUserRoles,
  ) {
    // Check if assignment already exists
    const existing = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      workspaceId,
      PrincipalType.TEAM,
      teamId,
    );

    if (existing) {
      // Update the role if different
      if (existing.roles !== role) {
        await PrincipalAssignment.update(
          context,
          ResourceType.WORKSPACE,
          workspaceId,
          PrincipalType.TEAM,
          teamId,
          { roles: role },
        );
      }
    } else {
      // Create workspace assignment for this team
      await PrincipalAssignment.insert(context, {
        resource_type: ResourceType.WORKSPACE,
        resource_id: workspaceId,
        principal_type: PrincipalType.TEAM,
        principal_ref_id: teamId,
        roles: role,
      });
    }
  }

  /**
   * Get the current workspace role for a team (if assigned).
   */
  private async getWorkspaceRole(
    context: NcContext,
    teamId: string,
    workspaceId: string,
  ): Promise<string | undefined> {
    const assignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      workspaceId,
      PrincipalType.TEAM,
      teamId,
    );
    return assignment?.roles;
  }

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
    const team = await Team.getByScimExternalId(
      context,
      param.workspaceId,
      param.scimId,
    );

    if (!team) {
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
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const startIndex = param.startIndex || 1;
    const count = Math.min(param.count || 100, 100);
    const ascending =
      !param.sortOrder || param.sortOrder.toLowerCase() === 'ascending';

    // Parse SCIM filter into DB-level params
    let filterDisplayName: string | undefined;
    let filterExternalId: string | undefined;
    if (param.filter) {
      const displayNameMatch = param.filter.match(
        /displayName\s+eq\s+"([^"]+)"/i,
      );
      if (displayNameMatch) filterDisplayName = displayNameMatch[1];

      const externalIdMatch = param.filter.match(
        /externalId\s+eq\s+"([^"]+)"/i,
      );
      if (externalIdMatch) filterExternalId = externalIdMatch[1];
    }

    // SQL-level filtering, sorting, and pagination
    const { list: paginatedTeams, totalResults } = await Team.scimList(
      context,
      {
        fk_workspace_id: param.workspaceId,
        offset: startIndex - 1,
        limit: count,
        filterDisplayName,
        filterExternalId,
        sortBy: param.sortBy,
        sortAscending: ascending,
      },
    );

    const excludeMembers = this.shouldExcludeMembers(param.excludedAttributes);
    const resources = [];
    for (const t of paginatedTeams) {
      resources.push(
        await this.toScimGroup(context, t, param.workspaceId, excludeMembers),
      );
    }

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
      throw new HttpException(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          scimType: 'invalidValue',
          detail: 'displayName is required',
          status: '400',
        },
        400,
      );
    }

    // Check if team with same name already exists
    const existingTeams = await Team.list(context, {
      fk_workspace_id: workspaceId,
    });

    const existingTeam = existingTeams.find(
      (t) => t.title === scimGroup.displayName && !t.deleted,
    );

    // Extract workspace role from NocoDB extension attribute (if present)
    const workspaceRole = this.extractWorkspaceRole(scimGroup);

    if (existingTeam) {
      // If team exists but not SCIM-managed, convert it to SCIM-managed
      if (!existingTeam.scim_managed) {
        // Team.update returns the full updated record (via metaGet)
        const updatedTeam = await Team.update(context, existingTeam.id, {
          scim_external_id: uuidv4(), // Server-assigned SCIM id (immutable)
          scim_managed: true,
          scim_display_name: scimGroup.displayName,
          ...(scimGroup.externalId
            ? { scim_meta: { externalId: scimGroup.externalId } }
            : {}),
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

        // Assign workspace role if provided
        if (workspaceRole) {
          await this.assignWorkspaceRole(
            context,
            existingTeam.id,
            workspaceId,
            workspaceRole,
          );
        }

        return this.toScimGroup(
          context,
          updatedTeam || existingTeam,
          workspaceId,
        );
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

    // Create new team — scim_external_id is server-assigned (immutable per RFC 7643)
    // (Team.insert returns the full record via metaGet)
    const team = await Team.insert(context, {
      title: scimGroup.displayName,
      fk_workspace_id: workspaceId,
      scim_external_id: uuidv4(),
      scim_managed: true,
      scim_display_name: scimGroup.displayName,
      ...(scimGroup.externalId
        ? { scim_meta: { externalId: scimGroup.externalId } }
        : {}),
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

    // Assign workspace role if provided
    if (workspaceRole) {
      await this.assignWorkspaceRole(
        context,
        team.id,
        workspaceId,
        workspaceRole,
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

    const team = await Team.getByScimExternalId(context, workspaceId, scimId);

    if (!team) {
      NcError.notFound('Group not found');
    }

    // SCIM PatchOp format — Operations array is the canonical path
    if (scimGroup.Operations) {
      const patchedTeam = await this.applyPatchOperations(
        context,
        team,
        workspaceId,
        scimGroup.Operations,
      );
      return this.toScimGroup(context, patchedTeam || team, workspaceId);
    }

    // Fallback: handle direct attribute updates (non-standard but some IdPs use it)
    const updateData: any = {};
    if (scimGroup.displayName && scimGroup.displayName !== team.title) {
      updateData.title = scimGroup.displayName;
      updateData.scim_display_name = scimGroup.displayName;
    }

    let updatedTeam = team;
    if (Object.keys(updateData).length > 0) {
      updatedTeam = (await Team.update(context, team.id, updateData)) || team;
    }

    // Handle direct membership updates
    if (scimGroup.members !== undefined) {
      await this.updateTeamMembers(
        context,
        team.id,
        workspaceId,
        scimGroup.members || [],
      );
    }

    // Handle workspace role from extension attribute
    const workspaceRole = this.extractWorkspaceRole(scimGroup);
    if (workspaceRole) {
      await this.assignWorkspaceRole(
        context,
        team.id,
        workspaceId,
        workspaceRole,
      );
    }

    return this.toScimGroup(context, updatedTeam, workspaceId);
  }

  /**
   * Replace group (PUT - full replacement per RFC 7644 §3.5.1)
   */
  async replaceGroup(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      scimGroup: any;
    },
  ) {
    const { workspaceId, scimId, scimGroup } = param;

    const team = await Team.getByScimExternalId(context, workspaceId, scimId);

    if (!team) {
      NcError.notFound('Group not found');
    }

    // Full replacement — update mutable group attributes
    // Note: scim_external_id is server-assigned and immutable per RFC 7643 §3.1
    const updateData: any = {};
    if (scimGroup.displayName) {
      updateData.title = scimGroup.displayName;
      updateData.scim_display_name = scimGroup.displayName;
    }
    if (scimGroup.externalId !== undefined) {
      const currentMeta =
        typeof team.scim_meta === 'object' ? team.scim_meta : {};
      updateData.scim_meta = {
        ...currentMeta,
        externalId: scimGroup.externalId,
      };
    }

    // Team.update returns the full updated record (via metaGet)
    let updatedTeam = team;
    if (Object.keys(updateData).length > 0) {
      updatedTeam = (await Team.update(context, team.id, updateData)) || team;
    }

    // Full replacement of members — replace entirely with provided list
    await this.updateTeamMembers(
      context,
      team.id,
      workspaceId,
      scimGroup.members || [],
    );

    // Update workspace role if provided in the extension
    const workspaceRole = this.extractWorkspaceRole(scimGroup);
    if (workspaceRole) {
      await this.assignWorkspaceRole(
        context,
        team.id,
        workspaceId,
        workspaceRole,
      );
    }

    return this.toScimGroup(context, updatedTeam, workspaceId);
  }

  /**
   * Delete group (soft delete)
   */
  async deleteGroup(
    context: NcContext,
    param: { workspaceId: string; scimId: string },
  ) {
    const team = await Team.getByScimExternalId(
      context,
      param.workspaceId,
      param.scimId,
    );

    // RFC 7644 §3.6: Return 404 if the resource does not exist
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
  ): Promise<any> {
    const scimMeta = typeof team.scim_meta === 'object' ? team.scim_meta : {};

    // Check if team has a workspace role assignment
    const wsRole = await this.getWorkspaceRole(context, team.id, workspaceId);
    const hasExtension = !!wsRole;

    const result: any = {
      schemas: hasExtension
        ? [
            'urn:ietf:params:scim:schemas:core:2.0:Group',
            NOCODB_GROUP_EXTENSION,
          ]
        : ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: team.scim_external_id, // Server-assigned immutable ID
      ...(scimMeta.externalId ? { externalId: scimMeta.externalId } : {}),
      displayName: team.scim_display_name || team.title,
      meta: {
        resourceType: 'Group',
        location: `/scim/v2/Groups/${team.scim_external_id}`,
        ...(team.created_at
          ? { created: new Date(team.created_at).toISOString() }
          : {}),
        ...(team.updated_at
          ? { lastModified: new Date(team.updated_at).toISOString() }
          : team.created_at
          ? { lastModified: new Date(team.created_at).toISOString() }
          : {}),
      },
    };

    // Include the NocoDB extension with workspace role
    if (wsRole && WORKSPACE_ROLE_TO_LABEL[wsRole]) {
      result[NOCODB_GROUP_EXTENSION] = {
        workspaceRole: WORKSPACE_ROLE_TO_LABEL[wsRole],
      };
    }

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

    // Include deactivated users — SCIM groups must reflect all assigned members
    const members = [];
    for (const userId of userIds) {
      const wu = await WorkspaceUser.get(workspaceId, userId, {
        include_deleted: true,
      });
      members.push(wu);
    }

    return members.filter((wu) => wu && wu.scim_managed);
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

    // Lookup target members sequentially (uses indexed scim_external_id column)
    const targetMembers = [];
    for (const m of scimMembers) {
      const wu = await WorkspaceUser.getByScimExternalId(workspaceId, m.value, {
        include_deleted: true,
      });
      if (wu) targetMembers.push(wu);
    }

    const targetUserIds = new Set(targetMembers.map((tm) => tm.fk_user_id));
    const currentUserIds = new Set(currentMembers.map((cm) => cm.fk_user_id));

    // Remove members not in target list
    for (const member of currentMembers) {
      if (!targetUserIds.has(member.fk_user_id)) {
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
      if (!currentUserIds.has(member.fk_user_id)) {
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
  ): Promise<any> {
    let latestTeam = team;
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
            // externalId is client-assigned — store in scim_meta
            const currentMeta =
              typeof latestTeam.scim_meta === 'object'
                ? latestTeam.scim_meta
                : {};
            updateData.scim_meta = {
              ...currentMeta,
              externalId: op.value,
            };
          }
          // Handle extension attribute path for workspaceRole
          if (
            op.path === `${NOCODB_GROUP_EXTENSION}:workspaceRole` &&
            op.value
          ) {
            const role = this.extractWorkspaceRole({
              [NOCODB_GROUP_EXTENSION]: { workspaceRole: op.value },
            });
            if (role) {
              await this.assignWorkspaceRole(
                context,
                team.id,
                workspaceId,
                role,
              );
            }
          }
        } else if (op.value && typeof op.value === 'object') {
          // Bulk replace: { op: "replace", value: { displayName: "...", externalId: "..." } }
          if (op.value.displayName) {
            updateData.title = op.value.displayName;
            updateData.scim_display_name = op.value.displayName;
          }
          if (op.value.externalId) {
            const currentMeta =
              typeof latestTeam.scim_meta === 'object'
                ? latestTeam.scim_meta
                : {};
            updateData.scim_meta = {
              ...currentMeta,
              externalId: op.value.externalId,
            };
          }
          // Handle extension in bulk replace value
          if (op.value[NOCODB_GROUP_EXTENSION]?.workspaceRole) {
            const role = this.extractWorkspaceRole({
              [NOCODB_GROUP_EXTENSION]: op.value[NOCODB_GROUP_EXTENSION],
            });
            if (role) {
              await this.assignWorkspaceRole(
                context,
                team.id,
                workspaceId,
                role,
              );
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          latestTeam =
            (await Team.update(context, team.id, updateData)) || latestTeam;
        }
      }
    }
    return latestTeam;
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

    // Lookup and insert members sequentially (uses indexed scim_external_id column)
    for (const member of members) {
      const wu = await WorkspaceUser.getByScimExternalId(
        workspaceId,
        member.value,
        { include_deleted: true },
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
    // Lookup and delete members sequentially (uses indexed scim_external_id column)
    for (const member of members) {
      const wu = await WorkspaceUser.getByScimExternalId(
        workspaceId,
        member.value,
        { include_deleted: true },
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
}
