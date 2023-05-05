import { workspaceCreate } from '../../ ../../../src/lib/services/workspace.svc'
import { NcUnitContext } from '../init';

export const createWorkspace = async (context: NcUnitContext, overrides = {}) => {
  const workspace = await workspaceCreate({
    workspaces: {
      title: 'test',
      meta: {},
      ...overrides
    },
    user: context.user,
  });
  return workspace;
}