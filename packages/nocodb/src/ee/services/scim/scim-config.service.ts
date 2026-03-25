import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import ScimConfig from '~/ee/models/ScimConfig';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class ScimConfigService {
  protected logger = new Logger(ScimConfigService.name);

  constructor() {}

  /**
   * Construct SCIM base URL at runtime from the request
   */
  private getBaseUrl(ncSiteUrl: string, workspaceId: string): string {
    return `${ncSiteUrl}/api/v3/meta/workspaces/${workspaceId}/scim/v2`;
  }

  async getConfig(
    context: NcContext,
    workspaceId: string,
    { ncSiteUrl }: { ncSiteUrl: string },
  ) {
    const config = await ScimConfig.get(context, workspaceId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    // Don't expose the full provisioning_token in the response
    return {
      ...config,
      base_url: this.getBaseUrl(ncSiteUrl, workspaceId),
      provisioning_token: config.provisioning_token ? '******' : null,
      token_exists: !!config.provisioning_token,
    };
  }

  async initializeConfig(
    context: NcContext,
    param: {
      workspaceId: string;
      ncSiteUrl: string;
    },
  ) {
    // Check if config already exists
    const existingConfig = await ScimConfig.get(context, param.workspaceId);

    if (existingConfig) {
      NcError.badRequest('SCIM is already configured for this workspace');
    }

    // Generate secure provisioning token and hash before storage
    const provisioningToken = this.generateProvisioningToken();
    const hashedToken = await bcrypt.hash(provisioningToken, BCRYPT_ROUNDS);

    const config = await ScimConfig.insert(context, {
      fk_workspace_id: param.workspaceId,
      enabled: false, // Start disabled until user activates
      provisioning_token: hashedToken,
      role_mapping: {}, // Default empty role mapping
    });

    return {
      id: config.id,
      enabled: config.enabled,
      base_url: this.getBaseUrl(param.ncSiteUrl, param.workspaceId),
      provisioning_token: provisioningToken, // Return plaintext only on creation
      role_mapping: config.role_mapping,
    };
  }

  async regenerateToken(context: NcContext, workspaceId: string) {
    const config = await ScimConfig.get(context, workspaceId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    const newToken = this.generateProvisioningToken();
    const hashedToken = await bcrypt.hash(newToken, BCRYPT_ROUNDS);

    await ScimConfig.update(context, workspaceId, {
      provisioning_token: hashedToken,
    });

    return {
      provisioning_token: newToken, // Return plaintext only once
    };
  }

  async updateConfig(
    context: NcContext,
    param: {
      workspaceId: string;
      ncSiteUrl: string;
      config: {
        enabled?: boolean;
        role_mapping?: Record<string, any>;
      };
    },
  ) {
    const existingConfig = await ScimConfig.get(context, param.workspaceId);

    if (!existingConfig) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    await ScimConfig.update(context, param.workspaceId, param.config);

    return this.getConfig(context, param.workspaceId, {
      ncSiteUrl: param.ncSiteUrl,
    });
  }

  async disableScim(context: NcContext, workspaceId: string) {
    const config = await ScimConfig.get(context, workspaceId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    await ScimConfig.update(context, workspaceId, {
      enabled: false,
    });

    return { message: 'SCIM provisioning disabled successfully' };
  }

  async deleteConfig(context: NcContext, workspaceId: string) {
    const config = await ScimConfig.get(context, workspaceId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    await ScimConfig.delete(context, workspaceId);

    return { message: 'SCIM configuration deleted successfully' };
  }

  async validateToken(
    context: NcContext,
    workspaceId: string,
    token: string,
  ): Promise<boolean> {
    const config = await ScimConfig.get(context, workspaceId);

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
