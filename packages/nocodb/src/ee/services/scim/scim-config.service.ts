import { randomBytes, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import ScimConfig from '~/ee/models/ScimConfig';

@Injectable()
export class ScimConfigService {
  protected logger = new Logger(ScimConfigService.name);

  constructor() {}

  async getConfig(context: NcContext, workspaceId: string) {
    const config = await ScimConfig.get(context, workspaceId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    // Don't expose the full provisioning_token in the response
    return {
      ...config,
      provisioning_token: config.provisioning_token ? '******' : null,
      token_exists: !!config.provisioning_token,
    };
  }

  async initializeConfig(
    context: NcContext,
    param: {
      workspaceId: string;
      siteUrl: string;
    },
  ) {
    // Check if config already exists
    const existingConfig = await ScimConfig.get(context, param.workspaceId);

    if (existingConfig) {
      NcError.badRequest('SCIM is already configured for this workspace');
    }

    // Generate secure provisioning token
    const provisioningToken = this.generateProvisioningToken();

    // Build SCIM base URL
    const baseUrl = `${param.siteUrl}/api/v3/meta/workspaces/${param.workspaceId}/scim/v2`;

    const config = await ScimConfig.insert(context, {
      fk_workspace_id: param.workspaceId,
      enabled: false, // Start disabled until user activates
      provisioning_token: provisioningToken,
      base_url: baseUrl,
      role_mapping: {}, // Default empty role mapping
    });

    return {
      id: config.id,
      enabled: config.enabled,
      base_url: config.base_url,
      provisioning_token: provisioningToken, // Return token on creation
      role_mapping: config.role_mapping,
    };
  }

  async regenerateToken(context: NcContext, workspaceId: string) {
    const config = await ScimConfig.get(context, workspaceId);

    if (!config) {
      NcError.notFound('SCIM configuration not found for this workspace');
    }

    const newToken = this.generateProvisioningToken();

    await ScimConfig.update(context, workspaceId, {
      provisioning_token: newToken,
    });

    return {
      provisioning_token: newToken,
    };
  }

  async updateConfig(
    context: NcContext,
    param: {
      workspaceId: string;
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

    return this.getConfig(context, param.workspaceId);
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

    const a = Buffer.from(config.provisioning_token);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private generateProvisioningToken(): string {
    // Generate a cryptographically secure random token
    // 32 bytes = 256 bits of entropy
    return randomBytes(32).toString('base64url');
  }
}
