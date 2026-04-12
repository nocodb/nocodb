import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AppEvents, EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import ScimConfig from '~/ee/models/ScimConfig';
import { MetaTable } from '~/utils/globals';
import Team from '~/ee/models/Team';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class ScimConfigService {
  protected logger = new Logger(ScimConfigService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * Construct SCIM base URL at runtime from the request
   */
  private getBaseUrl(ncSiteUrl: string, orgId: string): string {
    return `${ncSiteUrl}/api/v3/meta/orgs/${orgId}/scim/v2`;
  }

  async getConfig(
    context: NcContext,
    orgId: string,
    { ncSiteUrl }: { ncSiteUrl: string },
  ) {
    const config = await ScimConfig.get(context, orgId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this organization');
    }

    // Don't expose the full provisioning_token in the response
    return {
      ...config,
      base_url: this.getBaseUrl(ncSiteUrl, orgId),
      provisioning_token: config.provisioning_token ? '******' : null,
      token_exists: !!config.provisioning_token,
    };
  }

  async initializeConfig(
    context: NcContext,
    param: {
      orgId: string;
      ncSiteUrl: string;
      req?: any;
    },
  ) {
    // Check if config already exists
    const existingConfig = await ScimConfig.get(context, param.orgId);

    if (existingConfig) {
      NcError.badRequest('SCIM is already configured for this organization');
    }

    // Generate secure provisioning token and hash before storage
    const provisioningToken = this.generateProvisioningToken();
    const hashedToken = await bcrypt.hash(provisioningToken, BCRYPT_ROUNDS);

    const config = await ScimConfig.insert(context, {
      fk_org_id: param.orgId,
      enabled: false, // Start disabled until user activates
      provisioning_token: hashedToken,
      role_mapping: {}, // Default empty role mapping
      default_role: EnterpriseOrgUserRoles.VIEWER,
    });

    this.appHooksService.emit(AppEvents.SCIM_CONFIG_CREATE as any, {
      orgId: param.orgId,
      req: param.req,
    });

    return {
      id: config.id,
      enabled: config.enabled,
      base_url: this.getBaseUrl(param.ncSiteUrl, param.orgId),
      provisioning_token: provisioningToken, // Return plaintext only on creation
      role_mapping: config.role_mapping,
      default_role: config.default_role,
    };
  }

  async regenerateToken(context: NcContext, orgId: string, req?: any) {
    const config = await ScimConfig.get(context, orgId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this organization');
    }

    const newToken = this.generateProvisioningToken();
    const hashedToken = await bcrypt.hash(newToken, BCRYPT_ROUNDS);

    await ScimConfig.update(context, orgId, {
      provisioning_token: hashedToken,
    });

    this.appHooksService.emit(AppEvents.SCIM_CONFIG_TOKEN_REGENERATE as any, {
      orgId,
      req,
    });

    return {
      provisioning_token: newToken, // Return plaintext only once
    };
  }

  // Roles that can be assigned via SCIM default_role — never owner
  private static ALLOWED_DEFAULT_ROLES = new Set([
    EnterpriseOrgUserRoles.VIEWER,

    EnterpriseOrgUserRoles.CREATOR,
  ]);

  async updateConfig(
    context: NcContext,
    param: {
      orgId: string;
      ncSiteUrl: string;
      req?: any;
      config: {
        enabled?: boolean;
        default_role?: string;
        role_mapping?: Record<string, any>;
      };
    },
  ) {
    const existingConfig = await ScimConfig.get(context, param.orgId);

    if (!existingConfig) {
      NcError.notFound('SCIM configuration not found for this organization');
    }

    // Validate default_role against allowed roles (#6 — prevent privilege escalation)
    if (
      param.config.default_role &&
      !ScimConfigService.ALLOWED_DEFAULT_ROLES.has(
        param.config.default_role as EnterpriseOrgUserRoles,
      )
    ) {
      NcError.badRequest(
        `Invalid default role: ${param.config.default_role}. Allowed: ${[
          ...ScimConfigService.ALLOWED_DEFAULT_ROLES,
        ].join(', ')}`,
      );
    }

    await ScimConfig.update(context, param.orgId, param.config);

    if (param.config.enabled === false) {
      this.appHooksService.emit(AppEvents.SCIM_CONFIG_DISABLE as any, {
        orgId: param.orgId,
        req: param.req,
      });
    } else {
      this.appHooksService.emit(AppEvents.SCIM_CONFIG_UPDATE as any, {
        orgId: param.orgId,
        req: param.req,
      });
    }

    return this.getConfig(context, param.orgId, {
      ncSiteUrl: param.ncSiteUrl,
    });
  }

  async disableScim(context: NcContext, orgId: string) {
    const config = await ScimConfig.get(context, orgId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this organization');
    }

    await ScimConfig.update(context, orgId, {
      enabled: false,
    });

    return { message: 'SCIM provisioning disabled successfully' };
  }

  async deleteConfig(context: NcContext, orgId: string, req?: any) {
    const config = await ScimConfig.get(context, orgId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this organization');
    }

    await ScimConfig.delete(context, orgId);

    this.appHooksService.emit(AppEvents.SCIM_CONFIG_DELETE as any, {
      orgId,
      req,
    });

    // Clear scim_managed flag on org users and org teams
    // so they become manageable again after SCIM is disconnected.
    const ncMeta = Noco.ncMeta;

    // Clear scim_managed and scim_external_id on org users
    // so stale IDs from a previous provider don't conflict on reconnect
    await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('scim_managed', true)
      .update({ scim_managed: false, scim_external_id: null });

    // Clear scim_managed on org teams
    const scimTeamRows = await Team.list(context, {
      fk_org_id: orgId,
    });

    for (const team of scimTeamRows.filter((t) => t.scim_managed)) {
      await Team.update(context, team.id, {
        scim_managed: false,
        scim_external_id: null,
      });
    }

    return { message: 'SCIM configuration deleted successfully' };
  }

  async validateToken(
    context: NcContext,
    orgId: string,
    token: string,
  ): Promise<boolean> {
    const config = await ScimConfig.get(context, orgId);

    if (!config || !config.enabled) {
      return false;
    }

    // Compare incoming token against stored bcrypt hash
    // bcrypt.compare is inherently timing-safe
    return bcrypt.compare(token, config.provisioning_token);
  }

  private generateProvisioningToken(): string {
    // Generate a cryptographically secure random token
    // 32 bytes = 256 bits of entropy
    return randomBytes(32).toString('base64url');
  }
}
