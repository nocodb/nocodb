import { createProject, createSakilaProject } from '../../../factory/base';
import { getTable } from '../../../factory/table';
import init from '../../../init';

export const beforeEach = async () => {
  const context = await init();

  const sakilaProject = await createSakilaProject(context);
  const base = await createProject(context);

  const ctx = {
    workspace_id: base.fk_workspace_id!,
    base_id: base.id,
  };

  const countryTable = await getTable({
    base: sakilaProject,
    name: 'country',
  });

  const cityTable = await getTable({
    base: sakilaProject,
    name: 'city',
  });

  return {
    context,
    ctx,
    sakilaProject,
    base,
    countryTable,
    cityTable,
  };
};
