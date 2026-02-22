import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import type { NcContext } from '~/interface/config';
import { ScimConfigService } from '~/ee/services/scim/scim-config.service';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ScimBearerStrategy extends PassportStrategy(
  Strategy,
  'scim-bearer',
) {
  constructor(private scimConfigService: ScimConfigService) {
    super({ passReqToCallback: true });
  }

  async validate(req: any, token: string, done: any) {
    try {
      // Extract workspace ID from request (set by ScimAuthGuard)
      const workspaceId = req.workspaceId;

      if (!workspaceId) {
        return done(
          NcError.unauthorized('Workspace ID not found in request'),
          false,
        );
      }

      // Create minimal context for validation
      const context: NcContext = {
        workspace_id: workspaceId,
        base_id: null,
      };

      // Validate the bearer token against SCIM config
      const isValid = await this.scimConfigService.validateToken(
        context,
        workspaceId,
        token,
      );

      if (!isValid) {
        return done(
          NcError.unauthorized('Invalid SCIM authentication token'),
          false,
        );
      }

      // Return workspace context if valid
      return done(null, { workspaceId, context });
    } catch (error) {
      return done(error, false);
    }
  }
}
