import { WorkspaceV3Service as WorkspaceV3ServiceEE } from 'src/ee/services/v3/workspace-v3.service';
import type { NcContext } from '~/interface/config';
import type { WorkspaceV3Create } from '~/services/v3/workspace-v3.types';
import { NcError } from '~/helpers/catchError';

export class WorkspaceV3Service extends WorkspaceV3ServiceEE {
  // placeholder to be overridden
  override async validateWorkspaceCreate(
    _context: NcContext,
    { body }: { body: WorkspaceV3Create; cookie: any },
  ) {
    if (!body.org_id) {
      NcError.get(_context).invalidRequestBody(`Property 'org_id' is required`);
    }
    return true;
  }
}
