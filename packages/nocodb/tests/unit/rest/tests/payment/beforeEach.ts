import { createProject } from '../../../factory/base';
import init from '../../../init';
import type { ITestContext } from './helpers';

export const beforeEach = async () => {
  const context = await init();
  const base = await createProject(context);

  const ctx = {
    workspace_id: base.fk_workspace_id!,
    base_id: base.id,
  };

  return {
    context,
    ctx,
    base,
  } as ITestContext;
};
